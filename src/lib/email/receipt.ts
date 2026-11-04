import { formatMoney } from "../money";
import { GST_RATE } from "../invoices";
import { amountTable, button, C, type Email, esc, eyebrow, fine, layout, para, title } from "./layout";

// Figma 29 "Email · Receipt" (FR-PAY-04). Sent after a verified webhook confirms a bid,
// with the GST tax invoice attached as a PDF.

export type ReceiptEmailData = {
  invoiceNo: string;
  dateLabel: string; // "2 Nov 2026, 12:21 am"
  billedTo: string;
  listingName: string;
  boardLabel: string; // "Mumbai → Restaurants"
  rank: number | null;
  amount: number; // minor units, GST included
  taxable: number | null; // null when no GST applies (non-INR)
  tax: number | null;
  amountInWords: string;
  currency: string;
  receiptUrl: string;
  pdfName: string | null; // the attached invoice, if any
};

export const NON_REFUNDABLE = "Bids are final and non-refundable. Rank on the board can change as others bid.";
const FOOTER = "You're getting this because you paid for a bid with this email.";
const BODY = "Figtree,'Segoe UI',Helvetica,Arial,sans-serif";

/** Label/value rows: invoice number, date, billed to, business, board. */
function detailsTable(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) => `<tr>
<td style="padding:6px 0;width:38%;font:600 12px/18px ${BODY};letter-spacing:.06em;text-transform:uppercase;color:${C.muted};vertical-align:top">${esc(label)}</td>
<td style="padding:6px 0;font:400 15px/22px ${BODY};color:${C.ink};vertical-align:top">${esc(value)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">${cells}</table>`;
}

export function receiptEmail(d: ReceiptEmailData): Email {
  const money = (minor: number) => formatMoney(minor, d.currency);
  const subject = `Your receipt ${d.invoiceNo} · ${money(d.amount)} for ${d.listingName}`;
  const standing = d.rank ? ` It's now #${d.rank}.` : "";
  const summary = `Your bid on ${d.listingName} (${d.boardLabel}) is confirmed.${standing}`;
  const details: [string, string][] = [
    ["Invoice no.", d.invoiceNo],
    ["Date", d.dateLabel],
    ["Billed to", d.billedTo],
    ["Business", d.listingName],
    ["Board", d.boardLabel],
    ...(d.rank ? ([["Rank now", `#${d.rank}`]] as [string, string][]) : []),
  ];
  const amounts: [string, string][] =
    d.taxable !== null && d.tax !== null
      ? [["Taxable value", money(d.taxable)], [`GST at ${GST_RATE}%`, money(d.tax)], ["Total paid", money(d.amount)]]
      : [["Total paid", money(d.amount)]];
  const attached = d.pdfName ? `Your ${d.taxable !== null ? "GST tax invoice" : "receipt"} is attached as ${d.pdfName}.` : "";

  const content = [
    eyebrow(`Receipt · ${d.invoiceNo}`),
    title("Thanks for your bid"),
    para(esc(summary)),
    detailsTable(details),
    amountTable(amounts),
    `<p style="margin:0 0 16px;font:400 13px/19.5px ${BODY};color:${C.muted}">${esc(d.amountInWords)}</p>`,
    attached ? para(esc(attached)) : "",
    button(d.receiptUrl, "View invoice online"),
    fine(NON_REFUNDABLE),
  ]
    .filter(Boolean)
    .join("\n");

  const text = [
    `Receipt · ${d.invoiceNo}`,
    "",
    "Thanks for your bid",
    summary,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    ...amounts.map(([label, amount]) => `${label}: ${amount}`),
    d.amountInWords,
    "",
    ...(attached ? [attached, ""] : []),
    `View invoice online: ${d.receiptUrl}`,
    "",
    NON_REFUNDABLE,
    FOOTER,
  ].join("\n");
  return { subject, html: layout({ subject, preheader: `${money(d.amount)} paid. ${summary}`, content, footer: FOOTER }), text };
}
