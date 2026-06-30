import { describe, expect, it } from "vitest";
import { budgetSnapshot, copyBucketsForNewMonth, monthlyBudgetTotal, transactionIsValidSplit } from "../lib/budget";
import { defaultBuckets, expectedJulyTotalCents } from "../data/seed";
import type { BudgetTransaction } from "../types/models";

describe("budget calculations", () => {
  it("calculates the exact July 2026 total", () => {
    expect(monthlyBudgetTotal(defaultBuckets)).toBe(expectedJulyTotalCents);
  });

  it("counts unassigned spending in the overall total", () => {
    const transactions = [{ amountCents: 5000, allocations: [{ bucketId: null, amountCents: 5000 }] }] as BudgetTransaction[];
    const snapshot = budgetSnapshot(defaultBuckets, transactions);
    expect(snapshot.spentCents).toBe(5000);
    expect(snapshot.unassignedCents).toBe(5000);
    expect(snapshot.remainingCents).toBe(expectedJulyTotalCents - 5000);
  });

  it("validates exact split allocation totals", () => {
    expect(transactionIsValidSplit(1000, [{ bucketId: "a", amountCents: 600 }, { bucketId: "b", amountCents: 400 }])).toBe(true);
    expect(transactionIsValidSplit(1000, [{ bucketId: "a", amountCents: 999 }])).toBe(false);
  });

  it("copies buckets without carrying spending state", () => {
    const copied = copyBucketsForNewMonth(defaultBuckets);
    expect(copied).toEqual(defaultBuckets);
    expect(copied).not.toBe(defaultBuckets);
  });
});
