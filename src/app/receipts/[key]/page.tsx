import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/account/PrintButton";
import { NON_REFUNDABLE } from "@/lib/email";
import { invoiceByKey } from "@/lib/invoice-data";
import { GST_RATE } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";

// The link is private to the bidder, so keep it out of search engines.
export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

/** GST tax invoice for one paid bid (FR-PAY-04). Opened from the unguessable link in the receipt email. */
export default async function ReceiptPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const inv = await invoiceByKey(key);
  if (!inv) notFound();
  const money = (minor: number) => formatMoney(minor, inv.currency);

  return (
    <div className="inner receipt">
      <article className="card receipt-card">
        <header className="receipt-head">
          <div>
            <p className="eyebrow">{inv.gst ? "Tax invoice" : "Receipt"}</p>
            <h1 className="receipt-no">{inv.invoiceNo}</h1>
          </div>
          <div className="receipt-actions no-print">
            <a className="btn btn-primary btn-sm" href={`/receipts/${key}/pdf`} download={inv.fileName}>
              Download PDF
            </a>
            <PrintButton />
          </div>
        </header>

        <dl className="receipt-meta">
          <div>
            <dt>Date</dt>
            <dd>{inv.dateLabel}</dd>
          </div>
          <div>
            <dt>Billed to</dt>
            <dd>{inv.billedTo}</dd>
          </div>
          <div>
            <dt>Seller</dt>
            <dd>
              {inv.seller.name}
              {inv.seller.address && <span className="receipt-address">{inv.seller.address}</span>}
            </dd>
          </div>
          {inv.gst && (
            <div>
              <dt>GSTIN</dt>
              <dd>{inv.seller.gstin ?? "Not set"}</dd>
            </div>
          )}
          <div>
            <dt>Status</dt>
            <dd>{inv.status}</dd>
          </div>
        </dl>

        <div className="table-wrap receipt-table">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{inv.description}</td>
                <td className="num">{money(inv.taxable)}</td>
              </tr>
              {inv.gst && (
                <tr>
                  <td>GST at {GST_RATE}%</td>
                  <td className="num">{money(inv.tax)}</td>
                </tr>
              )}
              <tr className="receipt-total">
                <td>Total paid</td>
                <td className="num">{money(inv.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="receipt-words">{inv.amountInWords}</p>
        <p className="receipt-note">{NON_REFUNDABLE}</p>
      </article>
    </div>
  );
}
