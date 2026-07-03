import { describe, expect, it } from "vitest";
import { findDateMarkers, parseScreenshotAmount, type OcrLine } from "../features/imports/ocrParser";
import { parseUccuDate } from "../lib/dates";

describe("import parsing", () => {
  it("identifies screenshot debits and credits", () => {
    expect(parseScreenshotAmount("($39.16)")).toEqual({ kind: "debit", cents: 3916 });
    expect(parseScreenshotAmount("$180.30")).toEqual({ kind: "credit", cents: 18030 });
  });
  it("parses Excel-style and text dates", () => {
    expect(parseUccuDate("6/27/2026")).toBe("2026-06-27");
    expect(parseUccuDate(new Date(2026, 5, 27))).toBe("2026-06-27");
  });
  it("finds full and split UCCU screenshot dates", () => {
    const lines: OcrLine[] = [
      { text: "JUL 3 2026", bbox: { x0: 15, y0: 20, x1: 160, y1: 52 }, confidence: 92 },
      { text: "JUL 2", bbox: { x0: 15, y0: 180, x1: 95, y1: 210 }, confidence: 90 },
      { text: "2026", bbox: { x0: 16, y0: 218, x1: 92, y1: 248 }, confidence: 88 },
      { text: "HOME", bbox: { x0: 110, y0: 850, x1: 180, y1: 880 }, confidence: 95 }
    ];

    expect(findDateMarkers(lines, 2048, 947).map((marker) => ({
      month: marker.month,
      day: marker.day,
      year: marker.year
    }))).toEqual([
      { month: "JUL", day: "3", year: "2026" },
      { month: "JUL", day: "2", year: "2026" }
    ]);
  });
});
