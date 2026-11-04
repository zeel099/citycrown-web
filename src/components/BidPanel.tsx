"use client";

import Link from "next/link";
import { useState } from "react";
import type { BoardRow } from "@/lib/board-view";
import { formatMoney } from "@/lib/money";
import { bidShortcuts } from "@/lib/ranking";
import { WIDEN_LEAD } from "./board/bid-client";
import { ReportForm } from "./board/ReportForm";
import { useCheckout } from "./board/useCheckout";
import { VerifiedBadge } from "./board/VerifiedBadge";

type Props = {
  row: BoardRow;
  rows: BoardRow[];
  currency: string;
  step: number;
  minBid: number;
  initialAmount?: number; // minor units, from the claim headline
  onDone: (msg: string) => void;
};

/** Suggested amounts (FR-BID-03), each at least the minimum bid. listingId null is a business not on the board yet. */
export function amountOptions(rows: BoardRow[], listingId: string | null, step: number, minBid: number) {
  const shortcuts = bidShortcuts(rows, listingId, step, minBid).map((s) => ({ label: `Reach #${s.rank}`, minor: s.amount }));
  const isFirst = listingId !== null && rows.find((r) => r.id === listingId)?.rank === 1;
  const options = [...shortcuts, ...(isFirst ? [{ label: "Widen the lead", minor: Math.max(minBid, WIDEN_LEAD) }] : [])];
  // Fan support is the smallest bid, unless a shortcut already costs exactly that.
  return options.some((o) => o.minor === minBid) ? options : [...options, { label: "Fan support", minor: minBid }];
}

/** Inline bid form under a listing (FR-BID-01..06). Rank changes only after the webhook confirms. */
export function BidPanel({ row, rows, currency, step, minBid, initialAmount, onDone }: Props) {
  const [amount, setAmount] = useState<number | "">(initialAmount ? initialAmount / 100 : "");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { busy, error, pay } = useCheckout(onDone);

  const minor = typeof amount === "number" ? Math.round(amount * 100) : 0;
  const valid = minor >= minBid;
  const canPay = valid && agreed && email.includes("@") && !busy;
  const options = amountOptions(rows, row.id, step, minBid);

  const id = (field: string) => `bid-${field}-${row.id}`;
  return (
    <div className="bid">
      <div className="bid-head">
        <p className="eyebrow">Back this business</p>
        <h3 className="bid-title" id={`bid-title-${row.id}`} tabIndex={-1}>
          {row.name} · {row.rank ? `#${row.rank} with ${formatMoney(row.total, currency)}` : "Unranked"}
        </h3>
      </div>

      <form
        className="bid-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPay) pay({ listingId: row.id, amount: minor / 100, email, displayName: displayName || null, acceptedTerms: agreed });
        }}
      >
        <AmountFields id={id} options={options} amount={amount} minor={minor} minBid={minBid} currency={currency} onChange={setAmount} />
        <BidderFields id={id} email={email} displayName={displayName} onEmail={setEmail} onName={setDisplayName} />
        <TermsAndPay
          agreed={agreed}
          onAgree={setAgreed}
          error={error}
          busy={busy}
          canPay={canPay}
          label={valid ? `Pay ${formatMoney(minor, currency)} with UPI or card` : "Pay with UPI or card"}
          note={`Minimum ${formatMoney(minBid, currency)}. Rank changes once the payment is confirmed.`}
        />
      </form>

      <div className="bid-owner">
        {row.verified ? <VerifiedBadge label="Owner verified" /> : <Link className="text-link" href={`/verify/${row.id}`}>Own this business? Verify it</Link>}
      </div>
      {reporting ? (
        <ReportForm listingId={row.id} name={row.name} onClose={() => setReporting(false)} />
      ) : (
        <button type="button" className="link-btn bid-report" onClick={() => setReporting(true)}>
          Report this listing
        </button>
      )}
    </div>
  );
}

type AmountProps = {
  id: (field: string) => string;
  options: { label: string; minor: number }[];
  amount: number | "";
  minor: number;
  minBid: number;
  currency: string;
  onChange: (amount: number | "") => void;
};

export function AmountFields({ id, options, amount, minor, minBid, currency, onChange }: AmountProps) {
  return (
    <>
      {options.length > 0 && (
        <div className="bid-options" role="group" aria-label="Suggested amounts">
          {options.map((o) => (
            <button key={o.label} type="button" className="option" aria-pressed={minor === o.minor} onClick={() => onChange(o.minor / 100)}>
              {o.label} · <b>{formatMoney(o.minor, currency)}</b>
            </button>
          ))}
        </div>
      )}
      <div className="bid-amount">
        <label htmlFor={id("amount")}>Or enter an amount</label>
        <span className="bid-amount-input">
          <span aria-hidden="true">{currency === "INR" ? "₹" : currency}</span>
          <input
            id={id("amount")}
            type="number"
            min={minBid / 100}
            step={1}
            inputMode="numeric"
            value={amount}
            placeholder={String(minBid / 100)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
          />
        </span>
      </div>
    </>
  );
}

type BidderProps = {
  id: (field: string) => string;
  email: string;
  displayName: string;
  onEmail: (v: string) => void;
  onName: (v: string) => void;
};

export function BidderFields({ id, email, displayName, onEmail, onName }: BidderProps) {
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor={id("email")}>Email for your receipt</label>
        <input id={id("email")} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => onEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor={id("name")}>Name on the bid (optional)</label>
        <input id={id("name")} type="text" maxLength={40} placeholder="Anonymous" value={displayName} onChange={(e) => onName(e.target.value)} />
      </div>
    </div>
  );
}

type PayProps = {
  agreed: boolean;
  onAgree: (v: boolean) => void;
  error: string | null;
  busy: boolean;
  canPay: boolean;
  label: string;
  note: string;
};

export function TermsAndPay({ agreed, onAgree, error, busy, canPay, label, note }: PayProps) {
  return (
    <>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => onAgree(e.target.checked)} />
        <span>I understand bids are final and non-refundable, and that rank shows payment, not quality.</span>
      </label>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="bid-pay">
        <button type="submit" className="btn btn-primary bid-pay-btn" disabled={!canPay}>
          {busy ? "Waiting for payment…" : label}
        </button>
        <span className="bid-pay-note">{note}</span>
      </div>
      <p className="visually-hidden" role="status">
        {busy ? "Waiting for payment…" : ""}
      </p>
    </>
  );
}
