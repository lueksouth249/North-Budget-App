const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function dollarsToCents(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid amount");
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[$,()\s]/g, "");
  if (!cleaned || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) throw new Error("Invalid dollar amount");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) throw new Error("Invalid dollar amount");
  return Math.round(amount * 100);
}

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
