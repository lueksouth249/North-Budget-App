import type { CategoryRule, CategorySuggestion, MerchantProfile } from "../types/models";
import { merchantSimilarity } from "./merchant";

function amountMatches(rule: CategoryRule, amountCents: number): boolean {
  if (rule.exactAmountCents != null && amountCents !== rule.exactAmountCents) return false;
  if (rule.minAmountCents != null && amountCents < rule.minAmountCents) return false;
  if (rule.maxAmountCents != null && amountCents > rule.maxAmountCents) return false;
  return true;
}

export function matchExplicitRule(
  merchantKey: string,
  amountCents: number,
  rules: CategoryRule[]
): CategorySuggestion | null {
  const ordered = rules.filter((rule) => rule.enabled).sort((a, b) => b.priority - a.priority);
  for (const rule of ordered) {
    const merchantMatches = rule.matchType === "exact"
      ? merchantKey === rule.merchantKey
      : merchantKey.includes(rule.merchantKey);
    if (!merchantMatches || !amountMatches(rule, amountCents)) continue;
    const amountSpecific = rule.exactAmountCents != null || rule.minAmountCents != null || rule.maxAmountCents != null;
    return {
      bucketId: rule.targetBucketId,
      confidence: amountSpecific ? 0.995 : 0.98,
      source: "explicit-rule",
      reason: amountSpecific
        ? `Matched your saved ${merchantKey} amount rule.`
        : `Matched your saved ${merchantKey} merchant rule.`,
      merchantKey
    };
  }
  return null;
}

export function builtInDiscoverSuggestion(merchantKey: string): CategorySuggestion | null {
  if (/DISCOVER|DCIINTNET/.test(merchantKey)) {
    return {
      bucketId: "credit-card",
      confidence: 0.995,
      source: "discover-rule",
      reason: "Discover is always assigned to the Credit Card bucket.",
      merchantKey
    };
  }
  return null;
}

function statScore(profile: MerchantProfile, amountCents: number) {
  const stats = Object.values(profile.bucketStats);
  if (!stats.length) return null;
  const candidates = stats.map((stat) => {
    const effective = Math.max(0.1, stat.weightedCount - stat.rejectionCount * 1.5);
    const share = effective / Math.max(0.1, profile.weightedObservations);
    const variance = stat.amountCount > 1 ? stat.amountM2 / (stat.amountCount - 1) : 0;
    const std = Math.sqrt(Math.max(0, variance));
    const tolerance = Math.max(150, std * 2.25, Math.abs(stat.amountMeanCents) * 0.09);
    const distance = Math.abs(amountCents - stat.amountMeanCents);
    const amountFit = stat.amountCount > 0 ? Math.max(0, 1 - distance / Math.max(1, tolerance)) : 0;
    const recencyDays = Math.max(0, (Date.now() - new Date(`${stat.lastSeenDate}T12:00:00`).getTime()) / 86400000);
    const recency = Math.max(0, 1 - recencyDays / 730);
    const score = share * 0.68 + amountFit * 0.22 + recency * 0.1;
    return { stat, share, amountFit, score };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

export function matchHistoricalProfile(
  merchantKey: string,
  amountCents: number,
  profiles: MerchantProfile[]
): CategorySuggestion | null {
  const exact = profiles.find((profile) => profile.merchantKey === merchantKey);
  if (exact) {
    const best = statScore(exact, amountCents);
    if (!best) return null;
    const sameBucketStats = Object.values(exact.bucketStats).filter((s) => s.weightedCount > 0);
    const oneClearManualObservation = exact.observations === 1 && best.stat.manualCount + best.stat.correctedCount >= 1;
    const confidence = oneClearManualObservation
      ? 0.92
      : Math.min(0.98, 0.56 + best.share * 0.34 + best.amountFit * 0.08 + Math.min(exact.observations, 5) * 0.012);
    const amountReason = sameBucketStats.length > 1 && best.amountFit > 0.7
      ? `The amount closely matches past ${exact.displayMerchant} purchases assigned to this bucket.`
      : `${best.stat.bucketId} was used for ${Math.round(best.share * 100)}% of weighted ${exact.displayMerchant} history.`;
    return {
      bucketId: best.stat.bucketId,
      confidence,
      source: sameBucketStats.length > 1 && best.amountFit > 0.7 ? "amount-history" : "exact-history",
      reason: oneClearManualObservation
        ? `You assigned ${exact.displayMerchant} to this bucket last time.`
        : amountReason,
      merchantKey
    };
  }

  const fuzzy = profiles
    .map((profile) => ({ profile, similarity: merchantSimilarity(merchantKey, profile.merchantKey) }))
    .filter((item) => item.similarity >= 0.82)
    .sort((a, b) => b.similarity - a.similarity)[0];
  if (!fuzzy) return null;
  const best = statScore(fuzzy.profile, amountCents);
  if (!best) return null;
  return {
    bucketId: best.stat.bucketId,
    confidence: Math.min(0.82, 0.46 + fuzzy.similarity * 0.28 + best.share * 0.1),
    source: "fuzzy-history",
    reason: `This merchant looks like ${fuzzy.profile.displayMerchant}, which you usually assign to this bucket.`,
    merchantKey: fuzzy.profile.merchantKey
  };
}

export function getCategorySuggestion(args: {
  merchantKey: string;
  amountCents: number;
  rules: CategoryRule[];
  profiles: MerchantProfile[];
}): CategorySuggestion {
  return matchExplicitRule(args.merchantKey, args.amountCents, args.rules)
    ?? builtInDiscoverSuggestion(args.merchantKey)
    ?? matchHistoricalProfile(args.merchantKey, args.amountCents, args.profiles)
    ?? { bucketId: null, confidence: 0, source: "none", reason: "No reliable history was found." };
}
