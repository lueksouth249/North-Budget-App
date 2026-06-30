import type { Bucket } from "../types/models";

export const JULY_2026_MONTH_ID = "2026-07";

export const defaultBuckets: Bucket[] = [
  { id: "phone", emoji: "☎️", name: "Phone", section: "Bills & Subscriptions", order: 0, plannedCents: 4384 },
  { id: "spotify", emoji: "🎧", name: "Spotify", section: "Bills & Subscriptions", order: 1, plannedCents: 644 },
  { id: "chatgpt", emoji: "💻", name: "ChatGPT", section: "Bills & Subscriptions", order: 2, plannedCents: 2149 },
  { id: "health-insurance", emoji: "🏥", name: "Health Insurance", section: "Bills & Subscriptions", order: 3, plannedCents: 26500 },
  { id: "kindle", emoji: "📚", name: "Kindle", section: "Bills & Subscriptions", order: 4, plannedCents: 1300 },
  { id: "rent", emoji: "🏡", name: "Rent", section: "Bills & Subscriptions", order: 5, plannedCents: 115000 },
  { id: "wifi", emoji: "🛜", name: "WiFi", section: "Bills & Subscriptions", order: 6, plannedCents: 2056 },
  { id: "tithing", emoji: "⛪", name: "Tithing", section: "Bills & Subscriptions", order: 7, plannedCents: 87690 },
  { id: "credit-card", emoji: "💳", name: "Credit Card", section: "Bills & Subscriptions", order: 8, plannedCents: 4500 },
  { id: "groceries", emoji: "🛒", name: "Groceries", section: "Spending", order: 0, plannedCents: 40000 },
  { id: "gas", emoji: "⛽", name: "Gas", section: "Spending", order: 1, plannedCents: 17500 },
  { id: "date-money", emoji: "💌", name: "Date Money", section: "Spending", order: 2, plannedCents: 10000 },
  { id: "miscellaneous", emoji: "⁉️", name: "Miscellaneous", section: "Spending", order: 3, plannedCents: 10000 },
  { id: "luke-money", emoji: "💸", name: "Luke Money", section: "Spending", order: 4, plannedCents: 2500 },
  { id: "kimmi-money", emoji: "🤑", name: "Kimmi Money", section: "Spending", order: 5, plannedCents: 2500 },
  { id: "kimmi-hygiene", emoji: "💇‍♀️", name: "Kimmi Hygiene", section: "Spending", order: 6, plannedCents: 2500 },
  { id: "dance", emoji: "💃", name: "Dance", section: "Spending", order: 7, plannedCents: 10500 }
];

export const expectedJulyTotalCents = 339723;
