import { describe, expect, it } from "vitest";
import { normalizeMerchant } from "../lib/merchant";
import { applyLearningFeedback } from "../lib/learning";
import { builtInDiscoverSuggestion, getCategorySuggestion } from "../lib/rules";

describe("merchant normalization and learning", () => {
  it("normalizes UCCU merchant descriptions", () => {
    expect(normalizeMerchant("POS SMITHS FOOD #4136 350 N. FREEDOM PROVO UTUS").normalizedMerchant).toBe("SMITHS FOOD");
    expect(normalizeMerchant("Ext WD VENMO 260624PPZ95L - PAYMENT").normalizedMerchant).toBe("VENMO");
  });

  it("always recognizes Discover", () => {
    expect(builtInDiscoverSuggestion("DISCOVER")?.bucketId).toBe("credit-card");
  });

  it("auto-assigns a merchant after one manual historical assignment", () => {
    const profile = applyLearningFeedback({
      merchantKey: "CHICK-FIL-A",
      displayMerchant: "Chick-fil-A",
      bucketId: "date-money",
      amountCents: 1850,
      postDate: "2026-07-02",
      kind: "manual"
    });
    const suggestion = getCategorySuggestion({ merchantKey: "CHICK-FIL-A", amountCents: 2100, rules: [], profiles: [profile] });
    expect(suggestion.bucketId).toBe("date-money");
    expect(suggestion.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("uses amount history to distinguish an ambiguous merchant", () => {
    let profile = applyLearningFeedback({ merchantKey: "VENMO", displayMerchant: "Venmo", bucketId: "rent", amountCents: 115000, postDate: "2026-06-01", kind: "manual" });
    profile = applyLearningFeedback({ profile, merchantKey: "VENMO", displayMerchant: "Venmo", bucketId: "wifi", amountCents: 2056, postDate: "2026-06-02", kind: "manual" });
    const rent = getCategorySuggestion({ merchantKey: "VENMO", amountCents: 115000, rules: [], profiles: [profile] });
    const wifi = getCategorySuggestion({ merchantKey: "VENMO", amountCents: 2056, rules: [], profiles: [profile] });
    expect(rent.bucketId).toBe("rent");
    expect(wifi.bucketId).toBe("wifi");
  });
});
