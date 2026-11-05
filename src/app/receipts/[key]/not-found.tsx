import Link from "next/link";

export default function ReceiptNotFound() {
  return (
    <div className="inner receipt">
      <div className="card receipt-card">
        <h1 className="receipt-no">Receipt not found</h1>
        <p className="muted">This receipt link isn&apos;t valid. Open the receipt from the link in the email we sent after your payment.</p>
        <p>
          <Link className="btn btn-secondary btn-sm" href="/">
            See the boards
          </Link>
        </p>
      </div>
    </div>
  );
}
