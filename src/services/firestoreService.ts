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
  where,
  writeBatch,
  type Unsubscribe
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { env } from "../config/env";
import {
  defaultBuckets,
  JULY_2026_MONTH_ID
} from "../data/seed";
import type {
  BackupPayload,
  Bucket,
  BudgetMonth,
  BudgetTransaction,
  CategoryRule,
  MerchantProfile
} from "../types/models";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  return db;
}

const household = () =>
  doc(requireDb(), "households", env.householdId);

const bucketsCollection = (monthId: string) =>
  collection(
    household(),
    "months",
    monthId,
    "buckets"
  );

const transactionsCollection = () =>
  collection(household(), "transactions");

const rulesCollection = () =>
  collection(household(), "rules");

const profilesCollection = () =>
  collection(household(), "merchantProfiles");

const OMIT_FIRESTORE_VALUE = Symbol(
  "omit-firestore-value"
);

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function normalizeFirestoreValue(
  value: unknown
): unknown | typeof OMIT_FIRESTORE_VALUE {
  if (value === undefined) {
    return OMIT_FIRESTORE_VALUE;
  }

  if (Array.isArray(value)) {
    const normalized: unknown[] = [];

    for (const item of value) {
      const next = normalizeFirestoreValue(item);

      if (next !== OMIT_FIRESTORE_VALUE) {
        normalized.push(next);
      }
    }

    return normalized;
  }

  /*
   * Only recurse into normal JavaScript objects.
   *
   * Firestore timestamps, server timestamp sentinels,
   * document references, GeoPoints, Dates, and other
   * class instances must pass through unchanged.
   */
  if (!isPlainObject(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const next = normalizeFirestoreValue(item);

    if (next !== OMIT_FIRESTORE_VALUE) {
      normalized[key] = next;
    }
  }

  return normalized;
}

function toFirestoreData<T extends object>(
  value: T
): Record<string, unknown> {
  const normalized = normalizeFirestoreValue(value);

  if (
    normalized === OMIT_FIRESTORE_VALUE ||
    !isPlainObject(normalized)
  ) {
    throw new Error(
      "A Firestore document payload must be a plain object."
    );
  }

  return normalized;
}

let initialDataPromise: Promise<void> | null = null;

async function initializeData(): Promise<void> {
  const database = requireDb();
  const settingsRef = doc(
    household(),
    "settings",
    "app"
  );

  if ((await getDoc(settingsRef)).exists()) {
    return;
  }

  const batch = writeBatch(database);

  batch.set(
    household(),
    toFirestoreData({
      name: "North's Budget App",
      createdAt: serverTimestamp()
    }),
    { merge: true }
  );

  batch.set(
    settingsRef,
    toFirestoreData({
      schemaVersion: 1,
      initialized: true,
      createdAt: serverTimestamp()
    })
  );

  batch.set(
    doc(household(), "templates", "default"),
    toFirestoreData({
      buckets: defaultBuckets,
      updatedAt: serverTimestamp()
    })
  );

  batch.set(
    doc(
      household(),
      "months",
      JULY_2026_MONTH_ID
    ),
    toFirestoreData({
      initialized: true,
      createdAt: serverTimestamp()
    })
  );

  for (const bucket of defaultBuckets) {
    batch.set(
      doc(
        bucketsCollection(JULY_2026_MONTH_ID),
        bucket.id
      ),
      toFirestoreData(bucket)
    );
  }

  await batch.commit();
}

export function ensureInitialData(): Promise<void> {
  if (!initialDataPromise) {
    initialDataPromise = initializeData().catch(
      (error) => {
        initialDataPromise = null;
        throw error;
      }
    );
  }

  return initialDataPromise;
}

export function subscribeBuckets(
  monthId: string,
  callback: (buckets: Bucket[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(
      bucketsCollection(monthId),
      orderBy("section"),
      orderBy("order")
    ),
    (snapshot) => {
      const buckets = snapshot.docs
        .map((item) => item.data() as Bucket)
        .sort(
          (a, b) =>
            a.section.localeCompare(b.section) ||
            a.order - b.order
        );

      callback(buckets);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeTransactions(
  monthId: string,
  callback: (
    transactions: BudgetTransaction[]
  ) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(
      transactionsCollection(),
      where("monthId", "==", monthId),
      orderBy("postDate", "desc")
    ),
    (snapshot) => {
      const transactions = snapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...item.data()
          }) as BudgetTransaction
      );

      callback(transactions);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeRules(
  callback: (rules: CategoryRule[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    rulesCollection(),
    (snapshot) => {
      const rules = snapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...item.data()
          }) as CategoryRule
      );

      callback(rules);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeProfiles(
  callback: (profiles: MerchantProfile[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    profilesCollection(),
    (snapshot) => {
      const profiles = snapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...item.data()
          }) as MerchantProfile
      );

      callback(profiles);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function saveMonthBuckets(
  monthId: string,
  buckets: Bucket[]
): Promise<void> {
  const database = requireDb();
  const batch = writeBatch(database);

  batch.set(
    doc(household(), "months", monthId),
    toFirestoreData({
      initialized: true,
      updatedAt: serverTimestamp()
    }),
    { merge: true }
  );

  const existing = await getDocs(
    bucketsCollection(monthId)
  );

  const nextIds = new Set(
    buckets.map((bucket) => bucket.id)
  );

  existing.docs
    .filter((item) => !nextIds.has(item.id))
    .forEach((item) => {
      batch.delete(item.ref);
    });

  buckets.forEach((bucket) => {
    batch.set(
      doc(
        bucketsCollection(monthId),
        bucket.id
      ),
      toFirestoreData(bucket)
    );
  });

  await batch.commit();
}

export async function getBuckets(
  monthId: string
): Promise<Bucket[]> {
  const snapshot = await getDocs(
    bucketsCollection(monthId)
  );

  return snapshot.docs
    .map((item) => item.data() as Bucket)
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) ||
        a.order - b.order
    );
}

export async function getDefaultTemplate(): Promise<
  Bucket[]
> {
  const snapshot = await getDoc(
    doc(household(), "templates", "default")
  );

  return snapshot.exists()
    ? (snapshot.data().buckets as Bucket[])
    : structuredClone(defaultBuckets);
}

export async function saveDefaultTemplate(
  buckets: Bucket[]
): Promise<void> {
  await setDoc(
    doc(household(), "templates", "default"),
    toFirestoreData({
      buckets,
      updatedAt: serverTimestamp()
    })
  );
}

export async function saveTransaction(
  transaction: BudgetTransaction
): Promise<void> {
  const ref = doc(
    transactionsCollection(),
    transaction.id
  );

  const existing = await getDoc(ref);

  const payload = {
    ...transaction,
    updatedAt: serverTimestamp(),
    createdAt: existing.exists()
      ? existing.data().createdAt
      : serverTimestamp(),
    version:
      (existing.data()?.version ?? 0) + 1
  };

  await setDoc(
    ref,
    toFirestoreData(payload)
  );
}

export async function saveTransactions(
  transactions: BudgetTransaction[]
): Promise<void> {
  const database = requireDb();

  for (
    let offset = 0;
    offset < transactions.length;
    offset += 400
  ) {
    const batch = writeBatch(database);

    transactions
      .slice(offset, offset + 400)
      .forEach((transaction) => {
        batch.set(
          doc(
            transactionsCollection(),
            transaction.id
          ),
          toFirestoreData({
            ...transaction,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            version: 1
          })
        );
      });

    await batch.commit();
  }
}

export async function deleteTransaction(
  id: string
): Promise<void> {
  await deleteDoc(
    doc(transactionsCollection(), id)
  );
}

export async function getTransactionsByMonths(
  monthIds: string[]
): Promise<BudgetTransaction[]> {
  const all: BudgetTransaction[] = [];

  for (const monthId of monthIds) {
    const snapshot = await getDocs(
      query(
        transactionsCollection(),
        where("monthId", "==", monthId)
      )
    );

    all.push(
      ...snapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...item.data()
          }) as BudgetTransaction
      )
    );
  }

  return all;
}

export async function getAllTransactions(): Promise<
  BudgetTransaction[]
> {
  const snapshot = await getDocs(
    transactionsCollection()
  );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data()
      }) as BudgetTransaction
  );
}

export async function saveRule(
  rule: CategoryRule
): Promise<void> {
  await setDoc(
    doc(rulesCollection(), rule.id),
    toFirestoreData({
      ...rule,
      updatedAt: serverTimestamp()
    }),
    { merge: true }
  );
}

export async function deleteRule(
  id: string
): Promise<void> {
  await deleteDoc(
    doc(rulesCollection(), id)
  );
}

export async function saveProfile(
  profile: MerchantProfile
): Promise<void> {
  const profileId = encodeURIComponent(
    profile.merchantKey
  );

  await setDoc(
    doc(profilesCollection(), profileId),
    toFirestoreData({
      ...profile,
      id: profileId,
      updatedAt: serverTimestamp()
    })
  );
}

export async function replaceProfiles(
  profiles: MerchantProfile[]
): Promise<void> {
  const database = requireDb();
  const existing = await getDocs(
    profilesCollection()
  );

  const operationCount = Math.max(
    existing.size,
    profiles.length
  );

  for (
    let offset = 0;
    offset < operationCount;
    offset += 400
  ) {
    const batch = writeBatch(database);

    existing.docs
      .slice(offset, offset + 400)
      .forEach((item) => {
        batch.delete(item.ref);
      });

    profiles
      .slice(offset, offset + 400)
      .forEach((profile) => {
        const profileId = encodeURIComponent(
          profile.merchantKey
        );

        batch.set(
          doc(profilesCollection(), profileId),
          toFirestoreData({
            ...profile,
            id: profileId,
            updatedAt: serverTimestamp()
          })
        );
      });

    await batch.commit();
  }
}

export async function updateRule(
  id: string,
  values: Partial<CategoryRule>
): Promise<void> {
  const payload = toFirestoreData(values);

  if (!Object.keys(payload).length) {
    return;
  }

  await setDoc(
    doc(rulesCollection(), id),
    payload,
    { merge: true }
  );
}

export async function getAllMonthIds(): Promise<
  string[]
> {
  const snapshot = await getDocs(
    collection(household(), "months")
  );

  return snapshot.docs
    .map((item) => item.id)
    .sort();
}

export async function getAllRules(): Promise<
  CategoryRule[]
> {
  const snapshot = await getDocs(
    rulesCollection()
  );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data()
      }) as CategoryRule
  );
}

export async function getAllProfiles(): Promise<
  MerchantProfile[]
> {
  const snapshot = await getDocs(
    profilesCollection()
  );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data()
      }) as MerchantProfile
  );
}

async function commitOperations(
  operations: Array<
    (
      batch: ReturnType<typeof writeBatch>
    ) => void
  >
): Promise<void> {
  const database = requireDb();

  for (
    let offset = 0;
    offset < operations.length;
    offset += 400
  ) {
    const batch = writeBatch(database);

    operations
      .slice(offset, offset + 400)
      .forEach((operation) => {
        operation(batch);
      });

    await batch.commit();
  }
}

export async function restoreBackupRemote(
  payload: BackupPayload,
  overwrite: boolean
): Promise<void> {
  if (overwrite) {
    const deleteOperations: Array<
      (
        batch: ReturnType<typeof writeBatch>
      ) => void
    > = [];

    const monthIds = await getAllMonthIds();

    for (const monthId of monthIds) {
      const bucketSnapshot = await getDocs(
        bucketsCollection(monthId)
      );

      bucketSnapshot.docs.forEach((item) => {
        deleteOperations.push((batch) => {
          batch.delete(item.ref);
        });
      });

      deleteOperations.push((batch) => {
        batch.delete(
          doc(household(), "months", monthId)
        );
      });
    }

    const collections = [
      transactionsCollection(),
      rulesCollection(),
      profilesCollection()
    ];

    for (const source of collections) {
      const snapshot = await getDocs(source);

      snapshot.docs.forEach((item) => {
        deleteOperations.push((batch) => {
          batch.delete(item.ref);
        });
      });
    }

    await commitOperations(deleteOperations);
  }

  const operations: Array<
    (
      batch: ReturnType<typeof writeBatch>
    ) => void
  > = [];

  payload.months.forEach(
    (month: BudgetMonth) => {
      operations.push((batch) => {
        batch.set(
          doc(
            household(),
            "months",
            month.id
          ),
          toFirestoreData({
            initialized: true,
            updatedAt: serverTimestamp()
          }),
          { merge: true }
        );
      });
    }
  );

  Object.entries(
    payload.bucketsByMonth
  ).forEach(([monthId, buckets]) => {
    buckets.forEach((bucket) => {
      operations.push((batch) => {
        batch.set(
          doc(
            bucketsCollection(monthId),
            bucket.id
          ),
          toFirestoreData(bucket)
        );
      });
    });
  });

  payload.transactions.forEach(
    (transaction) => {
      operations.push((batch) => {
        batch.set(
          doc(
            transactionsCollection(),
            transaction.id
          ),
          toFirestoreData({
            ...transaction,
            updatedAt: serverTimestamp()
          }),
          { merge: true }
        );
      });
    }
  );

  payload.rules.forEach((rule) => {
    operations.push((batch) => {
      batch.set(
        doc(rulesCollection(), rule.id),
        toFirestoreData(rule),
        { merge: true }
      );
    });
  });

  payload.profiles.forEach((profile) => {
    operations.push((batch) => {
      batch.set(
        doc(
          profilesCollection(),
          encodeURIComponent(
            profile.merchantKey
          )
        ),
        toFirestoreData(profile),
        { merge: true }
      );
    });
  });

  operations.push((batch) => {
    batch.set(
      doc(
        household(),
        "templates",
        "default"
      ),
      toFirestoreData({
        buckets: payload.defaultTemplate,
        updatedAt: serverTimestamp()
      })
    );
  });

  await commitOperations(operations);
}