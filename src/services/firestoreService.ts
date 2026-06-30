import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { env } from "../config/env";
import { defaultBuckets, JULY_2026_MONTH_ID } from "../data/seed";
import type { Bucket, BudgetTransaction, CategoryRule, MerchantProfile, BackupPayload, BudgetMonth } from "../types/models";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}
const household = () => doc(requireDb(), "households", env.householdId);
const bucketsCollection = (monthId: string) => collection(household(), "months", monthId, "buckets");
const transactionsCollection = () => collection(household(), "transactions");
const rulesCollection = () => collection(household(), "rules");
const profilesCollection = () => collection(household(), "merchantProfiles");

export async function ensureInitialData(): Promise<void> {
  const database = requireDb();
  const settingsRef = doc(household(), "settings", "app");
  if ((await getDoc(settingsRef)).exists()) return;
  const batch = writeBatch(database);
  batch.set(household(), { name: "North Budget", createdAt: serverTimestamp() }, { merge: true });
  batch.set(settingsRef, { schemaVersion: 1, initialized: true, createdAt: serverTimestamp() });
  batch.set(doc(household(), "templates", "default"), { buckets: defaultBuckets, updatedAt: serverTimestamp() });
  batch.set(doc(household(), "months", JULY_2026_MONTH_ID), { initialized: true, createdAt: serverTimestamp() });
  for (const bucket of defaultBuckets) batch.set(doc(bucketsCollection(JULY_2026_MONTH_ID), bucket.id), bucket);
  await batch.commit();
}

export function subscribeBuckets(monthId: string, callback: (buckets: Bucket[]) => void): Unsubscribe {
  return onSnapshot(query(bucketsCollection(monthId), orderBy("section"), orderBy("order")), (snapshot) => {
    callback(snapshot.docs.map((item) => item.data() as Bucket).sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order));
  });
}

export function subscribeTransactions(monthId: string, callback: (transactions: BudgetTransaction[]) => void): Unsubscribe {
  return onSnapshot(query(transactionsCollection(), where("monthId", "==", monthId), orderBy("postDate", "desc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as BudgetTransaction)));
  });
}

export function subscribeRules(callback: (rules: CategoryRule[]) => void): Unsubscribe {
  return onSnapshot(rulesCollection(), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CategoryRule))));
}

export function subscribeProfiles(callback: (profiles: MerchantProfile[]) => void): Unsubscribe {
  return onSnapshot(profilesCollection(), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MerchantProfile))));
}

export async function saveMonthBuckets(monthId: string, buckets: Bucket[]): Promise<void> {
  const database = requireDb();
  const batch = writeBatch(database);
  batch.set(doc(household(), "months", monthId), { initialized: true, updatedAt: serverTimestamp() }, { merge: true });
  const existing = await getDocs(bucketsCollection(monthId));
  const nextIds = new Set(buckets.map((bucket) => bucket.id));
  existing.docs.filter((item) => !nextIds.has(item.id)).forEach((item) => batch.delete(item.ref));
  buckets.forEach((bucket) => batch.set(doc(bucketsCollection(monthId), bucket.id), bucket));
  await batch.commit();
}

export async function getBuckets(monthId: string): Promise<Bucket[]> {
  const snapshot = await getDocs(bucketsCollection(monthId));
  return snapshot.docs.map((item) => item.data() as Bucket).sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order);
}

export async function getDefaultTemplate(): Promise<Bucket[]> {
  const snapshot = await getDoc(doc(household(), "templates", "default"));
  return snapshot.exists() ? (snapshot.data().buckets as Bucket[]) : structuredClone(defaultBuckets);
}

export async function saveDefaultTemplate(buckets: Bucket[]): Promise<void> {
  await setDoc(doc(household(), "templates", "default"), { buckets, updatedAt: serverTimestamp() });
}

export async function saveTransaction(transaction: BudgetTransaction): Promise<void> {
  const ref = doc(transactionsCollection(), transaction.id);
  const exists = await getDoc(ref);
  const payload = {
    ...transaction,
    updatedAt: serverTimestamp(),
    createdAt: exists.exists() ? exists.data().createdAt : serverTimestamp(),
    version: (exists.data()?.version ?? 0) + 1
  };
  await setDoc(ref, payload);
}

export async function saveTransactions(transactions: BudgetTransaction[]): Promise<void> {
  const database = requireDb();
  for (let offset = 0; offset < transactions.length; offset += 400) {
    const batch = writeBatch(database);
    transactions.slice(offset, offset + 400).forEach((transaction) => {
      batch.set(doc(transactionsCollection(), transaction.id), {
        ...transaction,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 1
      });
    });
    await batch.commit();
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(transactionsCollection(), id));
}

export async function getTransactionsByMonths(monthIds: string[]): Promise<BudgetTransaction[]> {
  const all: BudgetTransaction[] = [];
  for (const monthId of monthIds) {
    const snapshot = await getDocs(query(transactionsCollection(), where("monthId", "==", monthId)));
    all.push(...snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as BudgetTransaction)));
  }
  return all;
}

export async function getAllTransactions(): Promise<BudgetTransaction[]> {
  const snapshot = await getDocs(transactionsCollection());
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as BudgetTransaction));
}

export async function saveRule(rule: CategoryRule): Promise<void> {
  await setDoc(doc(rulesCollection(), rule.id), { ...rule, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteRule(id: string): Promise<void> { await deleteDoc(doc(rulesCollection(), id)); }

export async function saveProfile(profile: MerchantProfile): Promise<void> {
  await setDoc(doc(profilesCollection(), encodeURIComponent(profile.merchantKey)), { ...profile, id: encodeURIComponent(profile.merchantKey), updatedAt: serverTimestamp() });
}

export async function replaceProfiles(profiles: MerchantProfile[]): Promise<void> {
  const database = requireDb();
  const existing = await getDocs(profilesCollection());
  for (let offset = 0; offset < Math.max(existing.size, profiles.length); offset += 400) {
    const batch = writeBatch(database);
    existing.docs.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
    profiles.slice(offset, offset + 400).forEach((profile) => batch.set(doc(profilesCollection(), encodeURIComponent(profile.merchantKey)), {
      ...profile,
      id: encodeURIComponent(profile.merchantKey),
      updatedAt: serverTimestamp()
    }));
    await batch.commit();
  }
}

export async function updateRule(id: string, values: Partial<CategoryRule>): Promise<void> {
  await updateDoc(doc(rulesCollection(), id), values);
}


export async function getAllMonthIds(): Promise<string[]> {
  const snapshot = await getDocs(collection(household(), "months"));
  return snapshot.docs.map((item) => item.id).sort();
}

export async function getAllRules(): Promise<CategoryRule[]> {
  const snapshot = await getDocs(rulesCollection());
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CategoryRule));
}

export async function getAllProfiles(): Promise<MerchantProfile[]> {
  const snapshot = await getDocs(profilesCollection());
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MerchantProfile));
}

async function commitOperations(operations: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  const database = requireDb();
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(database);
    operations.slice(offset, offset + 400).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

export async function restoreBackupRemote(payload: BackupPayload, overwrite: boolean): Promise<void> {
  if (overwrite) {
    const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
    const monthIds = await getAllMonthIds();
    for (const monthId of monthIds) {
      const bucketSnapshot = await getDocs(bucketsCollection(monthId));
      bucketSnapshot.docs.forEach((item) => operations.push((batch) => batch.delete(item.ref)));
      operations.push((batch) => batch.delete(doc(household(), "months", monthId)));
    }
    const collections = [transactionsCollection(), rulesCollection(), profilesCollection()];
    for (const source of collections) {
      const snapshot = await getDocs(source);
      snapshot.docs.forEach((item) => operations.push((batch) => batch.delete(item.ref)));
    }
    await commitOperations(operations);
  }
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  payload.months.forEach((month: BudgetMonth) => operations.push((batch) => batch.set(doc(household(), "months", month.id), { initialized: true, updatedAt: serverTimestamp() }, { merge: true })));
  Object.entries(payload.bucketsByMonth).forEach(([monthId, buckets]) => buckets.forEach((bucket) => operations.push((batch) => batch.set(doc(bucketsCollection(monthId), bucket.id), bucket))));
  payload.transactions.forEach((transaction) => operations.push((batch) => batch.set(doc(transactionsCollection(), transaction.id), { ...transaction, updatedAt: serverTimestamp() }, { merge: true })));
  payload.rules.forEach((rule) => operations.push((batch) => batch.set(doc(rulesCollection(), rule.id), rule, { merge: true })));
  payload.profiles.forEach((profile) => operations.push((batch) => batch.set(doc(profilesCollection(), encodeURIComponent(profile.merchantKey)), profile, { merge: true })));
  operations.push((batch) => batch.set(doc(household(), "templates", "default"), { buckets: payload.defaultTemplate, updatedAt: serverTimestamp() }));
  await commitOperations(operations);
}
