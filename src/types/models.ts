import type { Timestamp } from "firebase/firestore";

export type TransactionSource = "manual" | "uccu-xls" | "uccu-screenshot";
export type FeedbackKind = "manual" | "accepted" | "corrected" | "auto";

export interface Bucket {
  id: string;
  name: string;
  emoji: string;
  section: string;
  order: number;
  plannedCents: number;
}

export interface BudgetMonth {
  id: string;
  initialized: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface TransactionAllocation {
  bucketId: string | null;
  amountCents: number;
}

export interface BudgetTransaction {
  id: string;
  householdId: string;
  monthId: string;
  postDate: string;
  rawDescription: string;
  normalizedMerchant: string;
  displayMerchant: string;
  amountCents: number;
  runningBalanceCents?: number;
  source: TransactionSource;
  sourceFingerprint?: string;
  allocations: TransactionAllocation[];
  note?: string;
  createdByUid: string;
  createdByEmail: string;
  updatedByUid: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  version?: number;
}

export interface CategoryRule {
  id: string;
  merchantKey: string;
  matchType: "exact" | "contains";
  exactAmountCents?: number;
  minAmountCents?: number;
  maxAmountCents?: number;
  targetBucketId: string;
  enabled: boolean;
  priority: number;
  createdAt?: Timestamp | string;
  lastUsedAt?: Timestamp | string;
}

export interface BucketLearningStat {
  bucketId: string;
  weightedCount: number;
  manualCount: number;
  acceptedCount: number;
  correctedCount: number;
  rejectionCount: number;
  amountCount: number;
  amountMeanCents: number;
  amountM2: number;
  amountMinCents: number;
  amountMaxCents: number;
  lastSeenDate: string;
}

export interface MerchantProfile {
  id: string;
  merchantKey: string;
  displayMerchant: string;
  observations: number;
  weightedObservations: number;
  bucketStats: Record<string, BucketLearningStat>;
  lastAssignedBucketId?: string;
  lastSeenDate?: string;
  updatedAt?: Timestamp | string;
}

export type SuggestionSource =
  | "explicit-rule"
  | "discover-rule"
  | "exact-history"
  | "amount-history"
  | "fuzzy-history"
  | "none";

export interface CategorySuggestion {
  bucketId: string | null;
  confidence: number;
  source: SuggestionSource;
  reason: string;
  merchantKey?: string;
}

export interface ParsedTransaction {
  tempId: string;
  postDate: string;
  rawDescription: string;
  normalizedMerchant: string;
  displayMerchant: string;
  amountCents: number;
  runningBalanceCents?: number;
  source: TransactionSource;
  sourceFingerprint?: string;
  duplicateState?: "new" | "duplicate" | "possible";
  suggestion?: CategorySuggestion;
  allocations: TransactionAllocation[];
  excluded?: boolean;
  warnings?: string[];
}

export interface ImportSummary {
  rowsRead: number;
  positiveIgnored: number;
  incompleteSkipped: number;
  duplicatesSkipped: number;
  possibleDuplicates: number;
  newDebits: number;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  householdId: string;
  months: BudgetMonth[];
  bucketsByMonth: Record<string, Bucket[]>;
  transactions: BudgetTransaction[];
  rules: CategoryRule[];
  profiles: MerchantProfile[];
  defaultTemplate: Bucket[];
}
