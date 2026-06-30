import { describe, expect, it } from "vitest";
import { isLikelyDuplicate } from "../lib/fingerprint";

describe("duplicate matching", () => {
  it("requires amount and date, and uses balance plus description", () => {
    const base = { postDate: "2026-06-27", rawDescription: "POS AMAZON.COM SEATTLE WAUS", normalizedMerchant: "AMAZON", amountCents: 9980, runningBalanceCents: 13610 };
    expect(isLikelyDuplicate(base, { ...base, rawDescription: "AMAZON.COM..." })).toBe("duplicate");
    expect(isLikelyDuplicate(base, { ...base, amountCents: 9981 })).toBe("different");
  });
});
