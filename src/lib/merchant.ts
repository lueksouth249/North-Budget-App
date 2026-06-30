const LOCATION_SUFFIXES = [
  /\bPROVO\s+UTUS\b/g,
  /\bOREM\s+UTUS\b/g,
  /\bSALT\s+LAKE\s+CIT(?:Y)?\s*UTUS\b/g,
  /\bSEATTLE\s+WAUS\b/g,
  /\bTROY\s+MIUS\b/g,
  /\b[A-Z ]+\s+(?:UT|WA|MI|CA|TX|AZ|CO)US\b/g
];

const FRIENDLY_NAMES: Array<[RegExp, string, string]> = [
  [/\bSMITHS(?: FOOD)?\b/, "SMITHS FOOD", "Smith’s Food"],
  [/\bSMITHS[- ]?FUEL\b/, "SMITHS FUEL", "Smith’s Fuel"],
  [/\bCHICK[- ]?FIL[- ]?A\b/, "CHICK-FIL-A", "Chick-fil-A"],
  [/\bMAVERIK\b/, "MAVERIK", "Maverik"],
  [/\bDISCOVER\b|\bDCIINTNET\b/, "DISCOVER", "Discover"],
  [/\bVENMO\b/, "VENMO", "Venmo"],
  [/\bAMAZON(?:\.COM)?\b/, "AMAZON", "Amazon"],
  [/\bWINCO(?: FOODS)?\b/, "WINCO FOODS", "WinCo Foods"],
  [/\bTARGET\b/, "TARGET", "Target"],
  [/\bTACO BELL\b/, "TACO BELL", "Taco Bell"],
  [/\bSPOTIFY\b/, "SPOTIFY", "Spotify"],
  [/\bCHATGPT\b|\bOPENAI\b/, "CHATGPT", "ChatGPT"],
  [/\bKINDLE\b|\bAMZN DIGITAL\b/, "KINDLE", "Kindle"]
];

function decodeEntities(text: string): string {
  if (typeof document === "undefined") return text.replace(/&amp;/gi, "&");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

export function normalizeMerchant(raw: string): { normalizedMerchant: string; displayMerchant: string } {
  let text = decodeEntities(String(raw ?? ""))
    .toUpperCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  text = text
    .replace(/^POS\s+/, "")
    .replace(/^EXT\s+WD\s+/, "")
    .replace(/^ACH\s+(?:DEBIT|WITHDRAWAL)\s+/, "")
    .replace(/^PURCHASE\s+/, "")
    .replace(/\s+-\s+(?:PAYMENT|E-PAYMENT)\s*$/, "")
    .replace(/\b\d{6,}[A-Z0-9]*\b/g, " ")
    .replace(/#\d+\b/g, " ");

  for (const pattern of LOCATION_SUFFIXES) text = text.replace(pattern, " ");
  text = text.replace(/\s+/g, " ").replace(/^[*\- ]+|[*\- ]+$/g, "").trim();

  for (const [pattern, key, display] of FRIENDLY_NAMES) {
    if (pattern.test(text)) return { normalizedMerchant: key, displayMerchant: display };
  }

  const trimmed = text
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  const normalizedMerchant = trimmed || String(raw).toUpperCase().trim().slice(0, 80) || "UNKNOWN MERCHANT";
  const displayMerchant = normalizedMerchant
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bSq \*/g, "")
    .trim();
  return { normalizedMerchant, displayMerchant };
}

export function merchantSimilarity(a: string, b: string): number {
  const left = a.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const right = b.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!left.length || !right.length) return 0;
  if (a === b) return 1;
  const setA = new Set(left);
  const setB = new Set(right);
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union ? intersection / union : 0;
  const prefix = a.startsWith(b) || b.startsWith(a) ? 0.92 : 0;
  return Math.max(jaccard, prefix);
}
