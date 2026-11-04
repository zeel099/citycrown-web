import type { BoardType, Prisma } from "@prisma/client";
import { db } from "./db";
import { siteUrl } from "./email/layout";
import { amountInWords, gstSplit } from "./invoices";

// One GST tax invoice (FR-PAY-04), shared by the receipt page, the PDF and the receipt email.

export type Invoice = {
  invoiceNo: string;
  fileName: string; // "Invoice-BITC-2627-000005.pdf"
  issuedAt: Date;
  dateLabel: string; // "2 Nov 2026, 12:21 am" in the board's city time zone
  status: "Paid" | "Refunded";
  billedTo: string;
  seller: { name: string; gstin: string | null; address: string | null; nameSet: boolean };
  listingName: string;
  boardLabel: string; // "Mumbai → Restaurants" (with "(Today)" for daily boards)
  description: string;
  currency: string;
  amount: number; // minor units, GST included
  taxable: number;
  tax: number; // 0 when no GST applies
  gst: boolean; // INR invoices carry GST
  amountInWords: string;
  receiptUrl: string;
  pdfUrl: string;
};

const PERIOD_SUFFIX: Record<BoardType, string> = { ALL_TIME: "", DAILY: " (Today)", WEEKLY: " (This week)" };

const include = { bid: { include: { user: true, listing: { include: { board: { include: { city: true, category: true } } } } } } } satisfies Prisma.PaymentInclude;
type PaymentWithBid = Prisma.PaymentGetPayload<{ include: typeof include }>;

function toInvoice(p: PaymentWithBid | null): Invoice | null {
  const bid = p?.bid;
  if (!p?.invoiceNo || !p.receiptKey || !bid || (bid.status !== "CONFIRMED" && bid.status !== "REVERSED")) return null;
  const { board } = bid.listing;
  const gst = bid.currency === "INR";
  const tax = p.tax ?? (gst ? gstSplit(bid.amount).tax : 0);
  const issuedAt = bid.confirmedAt ?? bid.createdAt;
  const boardLabel = `${board.city.name} → ${board.category.name}${PERIOD_SUFFIX[board.type]}`;
  const sellerName = process.env.SELLER_NAME?.trim();
  return {
    invoiceNo: p.invoiceNo,
    fileName: `Invoice-${p.invoiceNo.replace(/\//g, "-")}.pdf`,
    issuedAt,
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: board.city.timeZone,
    }).format(issuedAt),
    status: bid.status === "CONFIRMED" ? "Paid" : "Refunded",
    billedTo: bid.guestEmail ?? bid.user?.email ?? "",
    seller: {
      name: sellerName || "Best in the City (seller name not set)",
      gstin: process.env.SELLER_GSTIN?.trim() || null,
      address: process.env.SELLER_ADDRESS?.trim() || null,
      nameSet: !!sellerName,
    },
    listingName: bid.listing.name,
    boardLabel,
    description: `Bid on ${bid.listing.name}, ${boardLabel} board`,
    currency: bid.currency,
    amount: bid.amount,
    taxable: bid.amount - tax,
    tax,
    gst,
    amountInWords: amountInWords(bid.amount, bid.currency),
    receiptUrl: siteUrl(`/receipts/${p.receiptKey}`),
    pdfUrl: siteUrl(`/receipts/${p.receiptKey}/pdf`),
  };
}

/** From the private receipt link. */
export async function invoiceByKey(key: string): Promise<Invoice | null> {
  return toInvoice(await db.payment.findUnique({ where: { receiptKey: key }, include }));
}

export async function invoiceForBid(bidId: string): Promise<Invoice | null> {
  return toInvoice(await db.payment.findUnique({ where: { bidId }, include }));
}
