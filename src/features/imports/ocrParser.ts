import { createWorker, PSM } from "tesseract.js";
import type { ImportSummary, ParsedTransaction } from "../../types/models";
import { dollarsToCents } from "../../lib/currency";
import { createFingerprint } from "../../lib/fingerprint";
import { normalizeMerchant } from "../../lib/merchant";

const DATE_PATTERN = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})\s+(20\d{2})\b/i;
const DEBIT_PATTERN = /\(\s*\$\s*([\d,]+\.\d{2})\s*\)/;
const MONEY_PATTERN = /\$\s*([\d,]+\.\d{2})/;
const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

interface OcrLine { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number; }

function toIso(match: RegExpMatchArray): string {
  return `${match[3]}-${String(MONTHS[match[1].toUpperCase()]).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

export function parseScreenshotAmount(text: string): { kind: "debit" | "credit" | "none"; cents?: number } {
  const debit = text.match(DEBIT_PATTERN);
  if (debit) return { kind: "debit", cents: Math.abs(dollarsToCents(debit[1])) };
  const credit = text.match(MONEY_PATTERN);
  if (credit) return { kind: "credit", cents: Math.abs(dollarsToCents(credit[1])) };
  return { kind: "none" };
}

async function preprocess(file: File): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(1, 1800 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The screenshot could not be prepared for OCR.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const adjusted = gray > 210 ? 255 : gray < 80 ? 0 : Math.max(0, Math.min(255, (gray - 128) * 1.25 + 128));
    image.data[i] = image.data[i + 1] = image.data[i + 2] = adjusted;
  }
  context.putImageData(image, 0, 0);
  return { canvas, width: canvas.width, height: canvas.height };
}

export async function parseUccuScreenshots(
  files: File[],
  onProgress?: (message: string, progress: number) => void
): Promise<{ transactions: ParsedTransaction[]; summary: ImportSummary }> {
  if (!files.length) throw new Error("Choose at least one screenshot.");
  if (files.length > 5) throw new Error("Upload no more than five screenshots at a time.");
  const summary: ImportSummary = { rowsRead: 0, positiveIgnored: 0, incompleteSkipped: 0, duplicatesSkipped: 0, possibleDuplicates: 0, newDebits: 0 };
  const found: ParsedTransaction[] = [];
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress?.("Reading UCCU screenshots…", message.progress ?? 0);
    }
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  try {
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      onProgress?.(`Reading screenshot ${fileIndex + 1} of ${files.length}…`, fileIndex / files.length);
      const prepared = await preprocess(files[fileIndex]);
      const result = await worker.recognize(prepared.canvas, {}, { text: true, blocks: true, tsv: true });
      const blockLines: OcrLine[] = (result.data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({
          text: line.text,
          bbox: line.bbox,
          confidence: line.confidence
        })))
      );
      const tsvLines: OcrLine[] = !blockLines.length && result.data.tsv
        ? result.data.tsv.split("\n").slice(1).map((row) => row.split("\t")).filter((parts) => parts.length >= 12 && parts[0] === "5").map((parts) => ({
            text: parts[11] ?? "",
            bbox: { x0: Number(parts[6]), y0: Number(parts[7]), x1: Number(parts[6]) + Number(parts[8]), y1: Number(parts[7]) + Number(parts[9]) },
            confidence: Number(parts[10])
          }))
        : [];
      const rawLines = (blockLines.length ? blockLines : tsvLines)
        .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
        .filter((line) => line.text);
      const dateLines = rawLines
        .map((line) => ({ line, match: line.text.match(DATE_PATTERN) }))
        .filter((item): item is { line: OcrLine; match: RegExpMatchArray } => Boolean(item.match))
        .sort((a, b) => a.line.bbox.y0 - b.line.bbox.y0);

      for (let i = 0; i < dateLines.length; i += 1) {
        const current = dateLines[i];
        const nextY = dateLines[i + 1]?.line.bbox.y0 ?? prepared.height;
        const rowTop = current.line.bbox.y0;
        const rowBottom = nextY;
        if (rowTop < prepared.height * 0.015 || rowBottom > prepared.height * 0.995) {
          summary.incompleteSkipped += 1;
          continue;
        }
        const rowLines = rawLines.filter((line) => line.bbox.y0 >= rowTop && line.bbox.y0 < rowBottom);
        const debitLine = rowLines.find((line) => DEBIT_PATTERN.test(line.text));
        if (!debitLine) {
          if (rowLines.some((line) => MONEY_PATTERN.test(line.text))) summary.positiveIgnored += 1;
          continue;
        }
        const amount = parseScreenshotAmount(debitLine.text);
        if (amount.kind !== "debit" || !amount.cents) { summary.incompleteSkipped += 1; continue; }
        const balanceCandidates = rowLines
          .filter((line) => line.bbox.y0 > debitLine.bbox.y0 && MONEY_PATTERN.test(line.text) && !DEBIT_PATTERN.test(line.text))
          .sort((a, b) => a.bbox.y0 - b.bbox.y0);
        const balanceMatch = balanceCandidates[0]?.text.match(MONEY_PATTERN);
        const descriptionLines = rowLines
          .filter((line) => line.bbox.x0 < prepared.width * 0.78)
          .filter((line) => !DATE_PATTERN.test(line.text) && !MONEY_PATTERN.test(line.text))
          .filter((line) => !/Transactions|Details\s*&\s*Settings/i.test(line.text))
          .sort((a, b) => a.bbox.y0 - b.bbox.y0);
        const rawDescription = descriptionLines.map((line) => line.text).join(" ").replace(/^[©@O0 ]+/, "").trim();
        if (!rawDescription || !balanceMatch || current.line.confidence < 35 || debitLine.confidence < 35) {
          summary.incompleteSkipped += 1;
          continue;
        }
        const postDate = toIso(current.match);
        const runningBalanceCents = dollarsToCents(balanceMatch[1]);
        const merchant = normalizeMerchant(rawDescription);
        const sourceFingerprint = await createFingerprint({ postDate, rawDescription, amountCents: amount.cents, runningBalanceCents });
        found.push({
          tempId: crypto.randomUUID(),
          postDate,
          rawDescription,
          ...merchant,
          amountCents: amount.cents,
          runningBalanceCents,
          source: "uccu-screenshot",
          sourceFingerprint,
          duplicateState: "new",
          allocations: [{ bucketId: null, amountCents: amount.cents }]
        });
        summary.rowsRead += 1;
      }
    }
  } finally {
    await worker.terminate();
  }
  const unique = new Map(found.map((transaction) => [transaction.sourceFingerprint, transaction]));
  summary.duplicatesSkipped += found.length - unique.size;
  summary.newDebits = unique.size;
  return { transactions: [...unique.values()], summary };
}
