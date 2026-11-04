// Amounts are stored in minor units (paise, cents).

const LOCALE: Record<string, string> = { INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB" };

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export const toMinor = (major: number) => Math.round(major * 100);
