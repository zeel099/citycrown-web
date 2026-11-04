"use client";

import { useEffect, useRef, useState } from "react";

const REASONS = ["Fake or closed business", "Wrong name or links", "Offensive or not allowed here", "Something else"];

/** FR-LST-06: inline report form inside the bid panel; lands in the moderation queue. */
export function ReportForm({ listingId, name, onClose }: { listingId: string; name: string; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const first = useRef<HTMLSelectElement>(null);

  useEffect(() => first.current?.focus(), []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId,
          reason: details.trim() ? `${reason}: ${details.trim()}` : reason,
          reporterContact: contact.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="notice notice-good report-sent" role="status">
        Thanks. Our team will check {name} and remove it if it breaks the rules.
      </p>
    );
  }

  const id = (field: string) => `report-${field}-${listingId}`;
  return (
    <form className="report" onSubmit={send}>
      <fieldset>
        <legend>Report {name}</legend>
        <div className="field">
          <label htmlFor={id("reason")}>What&apos;s wrong?</label>
          <select ref={first} id={id("reason")} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("details")}>Details (optional)</label>
          <input id={id("details")} type="text" maxLength={400} value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={id("contact")}>Your email or phone (optional)</label>
          <input id={id("contact")} type="text" autoComplete="email" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="report-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? "Sending…" : "Send report"}
          </button>
          <button type="button" className="link-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
