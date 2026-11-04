import type { Prisma } from "@prisma/client";

// Tax invoices (FR-PAY-04): sequential numbers per Indian financial year and
// GST at 18%, included in the amount paid.

export const GST_RATE = 18;
const INVOICE_TIME_ZONE = "Asia/Kolkata";

/** Indian financial year label, April to March in IST: November 2026 → "2627", March 2027 → "2627". */
export function financialYear(at: Date, timeZone = INVOICE_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric" }).formatToParts(at);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const start = month >= 4 ? year : year - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

export function formatInvoiceNo(fy: string, sequence: number): string {
  return `BITC/${fy}/${String(sequence).padStart(6, "0")}`;
}

/** Splits a GST-inclusive amount (minor units) into taxable value and tax. */
export function gstSplit(amount: number): { taxable: number; tax: number } {
  const taxable = Math.round(amount / (1 + GST_RATE / 100));
  return { taxable, tax: amount - taxable };
}

/**
 * Takes the next invoice number for the financial year of `at`. Call inside the
 * payment transaction: the counter row stays locked until it commits, so numbers
 * are gap-free and never shared.
 */
export async function nextInvoiceNo(tx: Prisma.TransactionClient, at: Date): Promise<string> {
  const fy = financialYear(at);
  const counter = await tx.invoiceCounter.upsert({
    where: { fy },
    create: { fy, last: 1 },
    update: { last: { increment: 1 } },
  });
  return formatInvoiceNo(fy, counter.last);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Whole number in words, Indian grouping: 1,41,000 → "One Lakh Forty One Thousand". */
export function numberInWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  return [
    crore ? `${numberInWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    rest ? belowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Total in words for the invoice: 141050 paise → "Rupees One Thousand Four Hundred Ten and Paise Fifty Only". */
export function amountInWords(minor: number, currency: string): string {
  const major = Math.floor(minor / 100);
  const cents = minor % 100;
  const [unit, sub] = currency === "INR" ? ["Rupees", "Paise"] : [currency, "Cents"];
  return `${unit} ${numberInWords(major)}${cents ? ` and ${sub} ${belowHundred(cents)}` : ""} Only`;
}
