import { defaultBuckets, JULY_2026_MONTH_ID } from "../data/seed";
import type { Bucket, BudgetTransaction, CategoryRule, MerchantProfile } from "../types/models";

const KEY = "north-budget-demo-v1";
export interface LocalState {
  bucketsByMonth: Record<string, Bucket[]>;
  transactions: BudgetTransaction[];
  rules: CategoryRule[];
  profiles: MerchantProfile[];
  defaultTemplate: Bucket[];
}

function initialState(): LocalState {
  return {
    bucketsByMonth: { [JULY_2026_MONTH_ID]: structuredClone(defaultBuckets) },
    transactions: [],
    rules: [],
    profiles: [],
    defaultTemplate: structuredClone(defaultBuckets)
  };
}

export function loadLocalState(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    return { ...initialState(), ...JSON.parse(raw) };
  } catch {
    return initialState();
  }
}

export function saveLocalState(state: LocalState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("north-budget-local-change"));
}

export function clearLocalState(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("north-budget-local-change"));
}
