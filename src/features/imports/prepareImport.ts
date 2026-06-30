import type { BudgetTransaction, CategoryRule, MerchantProfile, ParsedTransaction } from "../../types/models";
import { isLikelyDuplicate } from "../../lib/fingerprint";
import { getCategorySuggestion } from "../../lib/rules";

export function prepareImportedTransactions(args: {
  parsed: ParsedTransaction[];
  existing: BudgetTransaction[];
  rules: CategoryRule[];
  profiles: MerchantProfile[];
}): ParsedTransaction[] {
  return args.parsed.map((transaction) => {
    const exact = transaction.sourceFingerprint
      ? args.existing.find((item) => item.sourceFingerprint === transaction.sourceFingerprint)
      : undefined;
    if (exact) return { ...transaction, duplicateState: "duplicate" };
    let possible = false;
    for (const existing of args.existing) {
      const state = isLikelyDuplicate(transaction, existing);
      if (state === "duplicate") return { ...transaction, duplicateState: "duplicate" };
      if (state === "possible") possible = true;
    }
    const suggestion = getCategorySuggestion({
      merchantKey: transaction.normalizedMerchant,
      amountCents: transaction.amountCents,
      rules: args.rules,
      profiles: args.profiles
    });
    return {
      ...transaction,
      duplicateState: possible ? "possible" : "new",
      suggestion,
      allocations: [{ bucketId: suggestion.confidence >= 0.58 ? suggestion.bucketId : null, amountCents: transaction.amountCents }]
    };
  });
}
