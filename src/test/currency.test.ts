import { describe, expect, it } from "vitest";
import { dollarsToCents, formatCurrency } from "../lib/currency";

describe("currency", () => {
  it("converts dollar strings to integer cents", () => {
    expect(dollarsToCents("$1,150.00")).toBe(115000);
    expect(dollarsToCents("29.21")).toBe(2921);
  });
  it("formats cents as USD", () => expect(formatCurrency(2921)).toBe("$29.21"));
});
