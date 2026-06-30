import { merchantSimilarity } from "./merchant";

export async function createFingerprint(args: {
  postDate: string;
  rawDescription: string;
  amountCents: number;
  runningBalanceCents?: number;
}): Promise<string> {
  const canonical = [
    args.postDate,
    args.rawDescription.toUpperCase().replace(/\s+/g, " ").trim(),
    args.amountCents,
    args.runningBalanceCents ?? ""
  ].join("|");
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function isLikelyDuplicate(a: {
  postDate: string;
  rawDescription: string;
  normalizedMerchant: string;
  amountCents: number;
  runningBalanceCents?: number;
}, b: {
  postDate: string;
  rawDescription: string;
  normalizedMerchant: string;
  amountCents: number;
  runningBalanceCents?: number;
}): "duplicate" | "possible" | "different" {
  if (a.postDate !== b.postDate || a.amountCents !== b.amountCents) return "different";
  const balancesMatch = a.runningBalanceCents != null && b.runningBalanceCents != null
    ? a.runningBalanceCents === b.runningBalanceCents
    : false;
  const descriptionMatch = merchantSimilarity(a.rawDescription, b.rawDescription) >= 0.82 ||
    merchantSimilarity(a.normalizedMerchant, b.normalizedMerchant) >= 0.92;
  if (balancesMatch && descriptionMatch) return "duplicate";
  if (descriptionMatch || balancesMatch) return "possible";
  return "different";
}
