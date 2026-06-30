import type { Bucket, BudgetTransaction, TransactionAllocation } from "../types/models";

export function monthlyBudgetTotal(buckets: Bucket[]): number {
  return buckets.reduce((total, bucket) => total + bucket.plannedCents, 0);
}

export function transactionIsValidSplit(amountCents: number, allocations: TransactionAllocation[]): boolean {
  return amountCents > 0 && allocations.length > 0 && allocations.every((a) => a.amountCents >= 0) &&
    allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0) === amountCents;
}

export function totalSpent(transactions: BudgetTransaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
}

export function spentByBucket(transactions: BudgetTransaction[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const transaction of transactions) {
    for (const allocation of transaction.allocations) {
      const key = allocation.bucketId ?? "unassigned";
      totals[key] = (totals[key] ?? 0) + allocation.amountCents;
    }
  }
  return totals;
}

export function budgetSnapshot(buckets: Bucket[], transactions: BudgetTransaction[]) {
  const budgetCents = monthlyBudgetTotal(buckets);
  const spentCents = totalSpent(transactions);
  const byBucket = spentByBucket(transactions);
  const unassignedCents = byBucket.unassigned ?? 0;
  const unassignedCount = transactions.filter((tx) => tx.allocations.some((a) => a.bucketId === null)).length;
  return {
    budgetCents,
    spentCents,
    remainingCents: budgetCents - spentCents,
    percentUsed: budgetCents > 0 ? spentCents / budgetCents : 0,
    byBucket,
    unassignedCents,
    unassignedCount,
    overBudgetBucketCount: buckets.filter((bucket) => (byBucket[bucket.id] ?? 0) > bucket.plannedCents).length
  };
}

export function copyBucketsForNewMonth(buckets: Bucket[]): Bucket[] {
  return buckets.map((bucket) => ({ ...bucket }));
}
