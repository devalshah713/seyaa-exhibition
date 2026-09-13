export type Currency = "USD" | "INR";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function money(value: number | undefined, currency: Currency): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return currency === "USD" ? usd.format(value) : inr.format(value);
}

export function numberOrDash(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

export function textOrDash(value: string | undefined): string {
  return value && value.trim() !== "" ? value : "—";
}
