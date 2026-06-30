import * as XLSX from "xlsx";
import type { ImportSummary, ParsedTransaction } from "../../types/models";
import { dollarsToCents } from "../../lib/currency";
import { monthIdFromDate, parseUccuDate } from "../../lib/dates";
import { createFingerprint } from "../../lib/fingerprint";
import { normalizeMerchant } from "../../lib/merchant";

const REQUIRED = ["post date", "description", "debit", "credit", "status", "balance"];
const normalizeHeader = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function parseUccuWorkbook(file: File): Promise<{ transactions: ParsedTransaction[]; summary: ImportSummary }> {
  const data = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", cellDates: true });
  } catch {
    throw new Error("The Excel workbook could not be read. Download a fresh UCCU export and try again.");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no worksheets.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return REQUIRED.every((name) => headers.includes(name));
  });
  if (headerIndex < 0) throw new Error(`Missing required UCCU columns: ${REQUIRED.join(", ")}`);
  const headers = rows[headerIndex].map(normalizeHeader);
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const transactions: ParsedTransaction[] = [];
  const summary: ImportSummary = { rowsRead: 0, positiveIgnored: 0, incompleteSkipped: 0, duplicatesSkipped: 0, possibleDuplicates: 0, newDebits: 0 };

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((cell) => String(cell ?? "").trim())) continue;
    summary.rowsRead += 1;
    const status = String(row[index.status] ?? "").trim().toLowerCase();
    if (status && status !== "posted") continue;
    const debitRaw = String(row[index.debit] ?? "").trim();
    const creditRaw = String(row[index.credit] ?? "").trim();
    if (!debitRaw) {
      if (creditRaw) summary.positiveIgnored += 1;
      continue;
    }
    const postDate = parseUccuDate(row[index["post date"]]);
    const rawDescription = String(row[index.description] ?? "").trim();
    if (!postDate || !rawDescription) {
      summary.incompleteSkipped += 1;
      continue;
    }
    let amountCents: number;
    try { amountCents = Math.abs(dollarsToCents(debitRaw)); } catch { summary.incompleteSkipped += 1; continue; }
    if (amountCents <= 0) continue;
    let runningBalanceCents: number | undefined;
    try {
      const balance = String(row[index.balance] ?? "").trim();
      if (balance) runningBalanceCents = dollarsToCents(balance);
    } catch { runningBalanceCents = undefined; }
    const merchant = normalizeMerchant(rawDescription);
    const sourceFingerprint = await createFingerprint({ postDate, rawDescription, amountCents, runningBalanceCents });
    transactions.push({
      tempId: crypto.randomUUID(),
      postDate,
      rawDescription,
      ...merchant,
      amountCents,
      runningBalanceCents,
      source: "uccu-xls",
      sourceFingerprint,
      duplicateState: "new",
      allocations: [{ bucketId: null, amountCents }]
    });
  }
  summary.newDebits = transactions.length;
  return { transactions, summary };
}

export function transactionMonth(transaction: ParsedTransaction): string {
  return monthIdFromDate(transaction.postDate);
}
