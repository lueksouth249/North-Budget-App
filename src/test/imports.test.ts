import { describe, expect, it } from "vitest";
import { parseScreenshotAmount } from "../features/imports/ocrParser";
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
});
