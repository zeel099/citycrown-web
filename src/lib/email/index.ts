import { amountInWords, gstSplit } from "../invoices";
import type { Email } from "./layout";
import { outbidAlertEmail } from "./outbid";
import { receiptEmail } from "./receipt";
import { verificationResultEmail } from "./verification-result";

export type { Email } from "./layout";
export { siteUrl } from "./layout";
export { receiptEmail, NON_REFUNDABLE, type ReceiptEmailData } from "./receipt";
export { outbidAlertEmail, takeBackPrice, type OutbidEmailData } from "./outbid";
export { verificationResultEmail, type VerificationResultData } from "./verification-result";

/** Sample data for /dev/emails/[name], matching the Figma frames. */
export const emailPreviews: Record<string, () => Email> = {
  receipt: () =>
    receiptEmail({
      invoiceNo: "BITC/2627/000014",
      dateLabel: "2 Nov 2026, 12:21 am",
      billedTo: "you@example.com",
      listingName: "Dumbbell Den",
      boardLabel: "Mumbai → Gyms",
      rank: 1,
      amount: 92000,
      ...gstSplit(92000),
      amountInWords: amountInWords(92000, "INR"),
      currency: "INR",
      receiptUrl: "http://localhost:3000/receipts/sample",
      pdfName: "Invoice-BITC-2627-000014.pdf",
    }),
  "outbid-alert": () =>
    outbidAlertEmail({
      listingName: "Brew Lane",
      boardLabel: "Surat · Cafes",
      leaderName: "The Kettle Room",
      leaderTotal: 520000,
      ownTotal: 500000,
      step: 10000,
      minBid: 10000,
      currency: "INR",
      boardUrl: "http://localhost:3000/surat/cafes",
    }),
  "verification-result": () =>
    verificationResultEmail({ listingName: "Monsoon Beans", method: "Instagram", verified: true, url: "http://localhost:3000/surat/cafes" }),
};
