import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { env } from "../config/env";
import { useAuth } from "./AuthContext";
import type {
  Bucket,
  BudgetTransaction,
  CategoryRule,
  MerchantProfile,
  FeedbackKind,
  BackupPayload
} from "../types/models";
import { JULY_2026_MONTH_ID, defaultBuckets } from "../data/seed";
import { applyLearningFeedback, rebuildProfilesFromTransactions } from "../lib/learning";
import { loadLocalState, saveLocalState, type LocalState } from "../services/localStore";
import {
  deleteRule as deleteRemoteRule,
  deleteTransaction as deleteRemoteTransaction,
  ensureInitialData,
  getAllTransactions,
  getAllMonthIds,
  getAllRules,
  getAllProfiles,
  restoreBackupRemote,
  getBuckets,
  getDefaultTemplate,
  getTransactionsByMonths,
  replaceProfiles,
  saveDefaultTemplate,
  saveMonthBuckets,
  saveProfile,
  saveRule,
  saveTransaction,
  saveTransactions,
  subscribeBuckets,
  subscribeProfiles,
  subscribeRules,
  subscribeTransactions
} from "../services/firestoreService";
import { firebaseConfigured } from "../config/env";
import { monthIdFromDate } from "../lib/dates";

interface SaveTransactionOptions {
  feedbackKind?: FeedbackKind;
  suggestedBucketId?: string | null;
  skipLearning?: boolean;
}

interface DataValue {
  monthId: string;
  setMonthId: (monthId: string) => void;
  buckets: Bucket[];
  transactions: BudgetTransaction[];
  rules: CategoryRule[];
  profiles: MerchantProfile[];
  loading: boolean;
  syncing: boolean;
  saveBuckets: (buckets: Bucket[]) => Promise<void>;
  initializeMonth: (strategy: "previous" | "template" | "blank") => Promise<void>;
  saveAsTemplate: () => Promise<void>;
  saveOneTransaction: (transaction: BudgetTransaction, options?: SaveTransactionOptions) => Promise<void>;
  saveManyTransactions: (transactions: BudgetTransaction[], options?: SaveTransactionOptions) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  saveOneRule: (rule: CategoryRule) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  fetchExistingTransactions: (monthIds: string[]) => Promise<BudgetTransaction[]>;
  fetchBucketsForMonth: (monthId: string) => Promise<Bucket[]>;
  rebuildLearning: () => Promise<number>;
  exportBackup: () => Promise<BackupPayload>;
  restoreBackup: (payload: BackupPayload, overwrite: boolean) => Promise<void>;
}

const AppDataContext = createContext<DataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const [monthId, setMonthId] = useState(JULY_2026_MONTH_ID);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [profiles, setProfiles] = useState<MerchantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refreshLocal = useCallback(() => {
    const state = loadLocalState();
    setBuckets(state.bucketsByMonth[monthId] ?? []);
    setTransactions(state.transactions.filter((transaction) => transaction.monthId === monthId).sort((a, b) => b.postDate.localeCompare(a.postDate)));
    setRules(state.rules);
    setProfiles(state.profiles);
    setLoading(false);
  }, [monthId]);

  useEffect(() => {
    if (!user) return;
    if (isDemo || !firebaseConfigured) {
      refreshLocal();
      window.addEventListener("north-budget-local-change", refreshLocal);
      return () => window.removeEventListener("north-budget-local-change", refreshLocal);
    }
    setLoading(true);
    let unsubs: Array<() => void> = [];
    ensureInitialData().then(() => {
      unsubs = [
        subscribeBuckets(monthId, (items) => { setBuckets(items); setLoading(false); }),
        subscribeTransactions(monthId, setTransactions),
        subscribeRules(setRules),
        subscribeProfiles(setProfiles)
      ];
    }).catch(() => setLoading(false));
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [user, isDemo, monthId, refreshLocal]);

  const mutateLocal = useCallback((mutator: (state: LocalState) => void) => {
    const state = loadLocalState();
    mutator(state);
    saveLocalState(state);
  }, []);

  const saveBuckets = useCallback(async (next: Bucket[]) => {
    setSyncing(true);
    try {
      if (isDemo) mutateLocal((state) => { state.bucketsByMonth[monthId] = next; });
      else await saveMonthBuckets(monthId, next);
    } finally { setSyncing(false); }
  }, [isDemo, monthId, mutateLocal]);

  const initializeMonth = useCallback(async (strategy: "previous" | "template" | "blank") => {
    let source: Bucket[] = [];
    if (strategy === "blank") source = [];
    if (strategy === "template") {
      source = isDemo ? loadLocalState().defaultTemplate : await getDefaultTemplate();
    }
    if (strategy === "previous") {
      const [year, month] = monthId.split("-").map(Number);
      const date = new Date(year, month - 2, 1);
      const previous = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      source = isDemo ? (loadLocalState().bucketsByMonth[previous] ?? loadLocalState().defaultTemplate) : await getBuckets(previous);
      if (!source.length) source = isDemo ? loadLocalState().defaultTemplate : await getDefaultTemplate();
    }
    await saveBuckets(source.map((bucket) => ({ ...bucket })));
  }, [isDemo, monthId, saveBuckets]);

  const saveAsTemplate = useCallback(async () => {
    if (isDemo) mutateLocal((state) => { state.defaultTemplate = structuredClone(buckets); });
    else await saveDefaultTemplate(buckets);
  }, [isDemo, buckets, mutateLocal]);

  const learn = useCallback(async (transaction: BudgetTransaction, kind: FeedbackKind, rejectedBucketId?: string | null) => {
    if (transaction.allocations.length !== 1 || !transaction.allocations[0].bucketId) return;
    const bucketId = transaction.allocations[0].bucketId;
    const existing = profiles.find((profile) => profile.merchantKey === transaction.normalizedMerchant);
    const profile = applyLearningFeedback({
      profile: existing,
      merchantKey: transaction.normalizedMerchant,
      displayMerchant: transaction.displayMerchant,
      bucketId,
      amountCents: transaction.amountCents,
      postDate: transaction.postDate,
      kind,
      rejectedBucketId
    });
    if (isDemo) {
      mutateLocal((state) => {
        state.profiles = [...state.profiles.filter((item) => item.merchantKey !== profile.merchantKey), profile];
      });
    } else {
      await saveProfile(profile);
    }
  }, [profiles, isDemo, mutateLocal]);

  const saveOneTransaction = useCallback(async (transaction: BudgetTransaction, options: SaveTransactionOptions = {}) => {
    setSyncing(true);
    try {
      if (isDemo) {
        mutateLocal((state) => {
          state.transactions = [...state.transactions.filter((item) => item.id !== transaction.id), transaction];
        });
      } else await saveTransaction(transaction);
      if (!options.skipLearning) {
        await learn(transaction, options.feedbackKind ?? "manual", options.suggestedBucketId && options.suggestedBucketId !== transaction.allocations[0]?.bucketId ? options.suggestedBucketId : null);
      }
    } finally { setSyncing(false); }
  }, [isDemo, mutateLocal, learn]);

  const saveManyTransactions = useCallback(async (items: BudgetTransaction[], options: SaveTransactionOptions = {}) => {
    setSyncing(true);
    try {
      if (isDemo) {
        mutateLocal((state) => {
          const ids = new Set(items.map((item) => item.id));
          state.transactions = [...state.transactions.filter((item) => !ids.has(item.id)), ...items];
        });
      } else await saveTransactions(items);
      if (!options.skipLearning) {
        const profileMap = new Map(profiles.map((profile) => [profile.merchantKey, structuredClone(profile)]));
        for (const item of items) {
          if (item.allocations.length !== 1 || !item.allocations[0].bucketId) continue;
          const merchantKey = item.normalizedMerchant;
          profileMap.set(merchantKey, applyLearningFeedback({
            profile: profileMap.get(merchantKey),
            merchantKey,
            displayMerchant: item.displayMerchant,
            bucketId: item.allocations[0].bucketId,
            amountCents: item.amountCents,
            postDate: item.postDate,
            kind: options.feedbackKind ?? "accepted"
          }));
        }
        const changedKeys = new Set(items.map((item) => item.normalizedMerchant));
        const changed = [...profileMap.values()].filter((profile) => changedKeys.has(profile.merchantKey));
        if (isDemo) mutateLocal((state) => {
          const changedMap = new Map(changed.map((profile) => [profile.merchantKey, profile]));
          state.profiles = [...state.profiles.filter((profile) => !changedMap.has(profile.merchantKey)), ...changed];
        });
        else for (const profile of changed) await saveProfile(profile);
      }
    } finally { setSyncing(false); }
  }, [isDemo, mutateLocal, profiles]);

  const removeTransaction = useCallback(async (id: string) => {
    if (isDemo) mutateLocal((state) => { state.transactions = state.transactions.filter((item) => item.id !== id); });
    else await deleteRemoteTransaction(id);
  }, [isDemo, mutateLocal]);

  const saveOneRule = useCallback(async (rule: CategoryRule) => {
    if (isDemo) mutateLocal((state) => { state.rules = [...state.rules.filter((item) => item.id !== rule.id), rule]; });
    else await saveRule(rule);
  }, [isDemo, mutateLocal]);

  const removeRule = useCallback(async (id: string) => {
    if (isDemo) mutateLocal((state) => { state.rules = state.rules.filter((item) => item.id !== id); });
    else await deleteRemoteRule(id);
  }, [isDemo, mutateLocal]);

  const fetchExistingTransactions = useCallback(async (monthIds: string[]) => {
    if (isDemo) {
      const state = loadLocalState();
      return state.transactions.filter((item) => monthIds.includes(item.monthId));
    }
    return getTransactionsByMonths(monthIds);
  }, [isDemo]);

  const fetchBucketsForMonth = useCallback(async (targetMonthId: string) => {
    if (isDemo) return loadLocalState().bucketsByMonth[targetMonthId] ?? [];
    return getBuckets(targetMonthId);
  }, [isDemo]);

  const rebuildLearning = useCallback(async () => {
    const all = isDemo ? loadLocalState().transactions : await getAllTransactions();
    const rebuilt = rebuildProfilesFromTransactions(all);
    if (isDemo) mutateLocal((state) => { state.profiles = rebuilt; });
    else await replaceProfiles(rebuilt);
    return rebuilt.length;
  }, [isDemo, mutateLocal]);

  const exportBackup = useCallback(async (): Promise<BackupPayload> => {
    if (isDemo) {
      const state = loadLocalState();
      const monthIds = Object.keys(state.bucketsByMonth).sort();
      return { schemaVersion: 1, exportedAt: new Date().toISOString(), householdId: env.householdId, months: monthIds.map((id) => ({ id, initialized: true })), bucketsByMonth: state.bucketsByMonth, transactions: state.transactions, rules: state.rules, profiles: state.profiles, defaultTemplate: state.defaultTemplate };
    }
    const monthIds = await getAllMonthIds();
    const bucketsByMonth: Record<string, Bucket[]> = {};
    for (const id of monthIds) bucketsByMonth[id] = await getBuckets(id);
    return { schemaVersion: 1, exportedAt: new Date().toISOString(), householdId: env.householdId, months: monthIds.map((id) => ({ id, initialized: true })), bucketsByMonth, transactions: await getAllTransactions(), rules: await getAllRules(), profiles: await getAllProfiles(), defaultTemplate: await getDefaultTemplate() };
  }, [isDemo]);

  const restoreBackup = useCallback(async (payload: BackupPayload, overwrite: boolean) => {
    if (payload.schemaVersion !== 1) throw new Error("This backup uses an unsupported schema version.");
    if (isDemo) {
      const current = loadLocalState();
      const next: LocalState = overwrite ? { bucketsByMonth: {}, transactions: [], rules: [], profiles: [], defaultTemplate: structuredClone(defaultBuckets) } : current;
      next.bucketsByMonth = { ...next.bucketsByMonth, ...payload.bucketsByMonth };
      const transactionMap = new Map(next.transactions.map((item) => [item.id, item]));
      payload.transactions.forEach((item) => transactionMap.set(item.id, item));
      next.transactions = [...transactionMap.values()];
      const ruleMap = new Map(next.rules.map((item) => [item.id, item])); payload.rules.forEach((item) => ruleMap.set(item.id, item)); next.rules = [...ruleMap.values()];
      const profileMap = new Map(next.profiles.map((item) => [item.merchantKey, item])); payload.profiles.forEach((item) => profileMap.set(item.merchantKey, item)); next.profiles = [...profileMap.values()];
      next.defaultTemplate = payload.defaultTemplate;
      saveLocalState(next);
    } else await restoreBackupRemote(payload, overwrite);
  }, [isDemo]);

  const value = useMemo<DataValue>(() => ({
    monthId,
    setMonthId,
    buckets,
    transactions,
    rules,
    profiles,
    loading,
    syncing,
    saveBuckets,
    initializeMonth,
    saveAsTemplate,
    saveOneTransaction,
    saveManyTransactions,
    removeTransaction,
    saveOneRule,
    removeRule,
    fetchExistingTransactions,
    fetchBucketsForMonth,
    rebuildLearning,
    exportBackup,
    restoreBackup
  }), [monthId, buckets, transactions, rules, profiles, loading, syncing, saveBuckets, initializeMonth, saveAsTemplate, saveOneTransaction, saveManyTransactions, removeTransaction, saveOneRule, removeRule, fetchExistingTransactions, fetchBucketsForMonth, rebuildLearning, exportBackup, restoreBackup]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): DataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}

export function makeTransaction(args: {
  postDate: string;
  rawDescription: string;
  displayMerchant: string;
  normalizedMerchant: string;
  amountCents: number;
  allocations: BudgetTransaction["allocations"];
  source: BudgetTransaction["source"];
  sourceFingerprint?: string;
  runningBalanceCents?: number;
  note?: string;
  user: { uid: string; email: string };
}): BudgetTransaction {
  return {
    id: crypto.randomUUID(),
    householdId: env.householdId,
    monthId: monthIdFromDate(args.postDate),
    postDate: args.postDate,
    rawDescription: args.rawDescription,
    normalizedMerchant: args.normalizedMerchant,
    displayMerchant: args.displayMerchant,
    amountCents: args.amountCents,
    runningBalanceCents: args.runningBalanceCents,
    source: args.source,
    sourceFingerprint: args.sourceFingerprint,
    allocations: args.allocations,
    note: args.note,
    createdByUid: args.user.uid,
    createdByEmail: args.user.email,
    updatedByUid: args.user.uid,
    version: 1
  };
}
