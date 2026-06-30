import type { BucketLearningStat, FeedbackKind, MerchantProfile } from "../types/models";

const FEEDBACK_WEIGHT: Record<FeedbackKind, number> = {
  manual: 3,
  corrected: 4,
  accepted: 2,
  auto: 1
};

function emptyStat(bucketId: string, amountCents: number, date: string): BucketLearningStat {
  return {
    bucketId,
    weightedCount: 0,
    manualCount: 0,
    acceptedCount: 0,
    correctedCount: 0,
    rejectionCount: 0,
    amountCount: 0,
    amountMeanCents: amountCents,
    amountM2: 0,
    amountMinCents: amountCents,
    amountMaxCents: amountCents,
    lastSeenDate: date
  };
}

export function applyLearningFeedback(args: {
  profile?: MerchantProfile;
  merchantKey: string;
  displayMerchant: string;
  bucketId: string;
  amountCents: number;
  postDate: string;
  kind: FeedbackKind;
  rejectedBucketId?: string | null;
}): MerchantProfile {
  const profile: MerchantProfile = args.profile
    ? { ...args.profile, bucketStats: structuredClone(args.profile.bucketStats) }
    : {
        id: args.merchantKey,
        merchantKey: args.merchantKey,
        displayMerchant: args.displayMerchant,
        observations: 0,
        weightedObservations: 0,
        bucketStats: {}
      };
  const stat = profile.bucketStats[args.bucketId] ?? emptyStat(args.bucketId, args.amountCents, args.postDate);
  const weight = FEEDBACK_WEIGHT[args.kind];
  const nextCount = stat.amountCount + 1;
  const delta = args.amountCents - stat.amountMeanCents;
  stat.amountMeanCents += delta / nextCount;
  stat.amountM2 += delta * (args.amountCents - stat.amountMeanCents);
  stat.amountCount = nextCount;
  stat.amountMinCents = Math.min(stat.amountMinCents, args.amountCents);
  stat.amountMaxCents = Math.max(stat.amountMaxCents, args.amountCents);
  stat.weightedCount += weight;
  stat.lastSeenDate = args.postDate;
  if (args.kind === "manual") stat.manualCount += 1;
  if (args.kind === "accepted") stat.acceptedCount += 1;
  if (args.kind === "corrected") stat.correctedCount += 1;
  profile.bucketStats[args.bucketId] = stat;

  if (args.rejectedBucketId && args.rejectedBucketId !== args.bucketId) {
    const rejected = profile.bucketStats[args.rejectedBucketId] ?? emptyStat(args.rejectedBucketId, args.amountCents, args.postDate);
    rejected.rejectionCount += 1;
    profile.bucketStats[args.rejectedBucketId] = rejected;
  }

  profile.observations += 1;
  profile.weightedObservations += weight;
  profile.lastAssignedBucketId = args.bucketId;
  profile.lastSeenDate = args.postDate;
  profile.displayMerchant = args.displayMerchant;
  return profile;
}

export function rebuildProfilesFromTransactions(
  transactions: Array<{ normalizedMerchant: string; displayMerchant: string; amountCents: number; postDate: string; allocations: Array<{ bucketId: string | null; amountCents: number }> }>
): MerchantProfile[] {
  const profiles = new Map<string, MerchantProfile>();
  for (const transaction of transactions) {
    if (transaction.allocations.length !== 1 || !transaction.allocations[0].bucketId) continue;
    const key = transaction.normalizedMerchant;
    profiles.set(key, applyLearningFeedback({
      profile: profiles.get(key),
      merchantKey: key,
      displayMerchant: transaction.displayMerchant,
      bucketId: transaction.allocations[0].bucketId,
      amountCents: transaction.amountCents,
      postDate: transaction.postDate,
      kind: "manual"
    }));
  }
  return [...profiles.values()];
}
