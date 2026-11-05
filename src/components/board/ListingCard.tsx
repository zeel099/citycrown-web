"use client";

import type { BoardRow } from "@/lib/board-view";
import { formatFollowers } from "@/lib/business-link";
import type { LatLng } from "@/lib/geo";
import { formatMoney } from "@/lib/money";
import { Avatar } from "./Avatar";
import { ListingDistance, ListingLocation } from "./ListingLocation";
import { VerifiedBadge } from "./VerifiedBadge";

type Props = {
  row: BoardRow;
  category: string;
  currency: string;
  claim: number | null; // "claim this rank for …": on the card being pointed at, else #1
  here: LatLng | null; // the visitor's location, once they've shared it
  open: boolean;
  onToggle: () => void;
  onPoint: () => void; // hovered or focused, so the headline can preview this rank
  onClaim: () => void; // the pill was pressed
  children?: React.ReactNode; // the bid panel, while open
};

const LINKS = [
  ["website", "Website"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
] as const;

const plural = (n: number, one: string) => `${n.toLocaleString("en-IN")} ${one}${n === 1 ? "" : "s"}`;

/** One business on the board (FR-BRD-04): rank, name, links and the amount behind the spot. */
export function ListingCard({ row: r, category, currency, claim, here, open, onToggle, onPoint, onClaim, children }: Props) {
  const meta: React.ReactNode[] = [category];
  if (here && r.location) meta.unshift(<ListingDistance location={r.location} here={here} />);
  if (r.rating) {
    meta.push(
      <span className="listing-rating">
        <span aria-hidden="true">★</span> {r.rating.stars.toFixed(1)} ({plural(r.rating.reviews, "Google review")})
      </span>,
    );
  }
  for (const [key, label] of LINKS) {
    if (r.links[key]) {
      meta.push(
        <a href={`/go/${r.id}?to=${key}`} target="_blank" rel="noopener">
          {label}
        </a>,
      );
      if (key === "instagram" && r.followers !== null) meta.push(<span className="listing-followers">{formatFollowers(r.followers)}</span>);
    }
  }
  if (r.lastBid) meta.push(`last bid ${r.lastBid}`);
  meta.push(plural(r.clicks, "click"));

  // The name opens the business's own site, else its Instagram or Facebook (through /go, which counts the click).
  const home = LINKS.find(([key]) => r.links[key]);
  const toggle = { "aria-expanded": open, "aria-controls": open ? `bid-${r.id}` : undefined, onClick: onToggle };

  const cls = ["listing", r.rank === 1 && "is-first", r.rank === null && "is-unranked", open && "is-open"].filter(Boolean).join(" ");
  return (
    // Touch has no hover: a tap opens the card instead.
    <li className={cls} onPointerEnter={(e) => e.pointerType !== "touch" && onPoint()} onFocus={onPoint}>
      {claim !== null && (
        <button type="button" className="pill-accent listing-pill" aria-label={`Claim #${r.rank} for ${formatMoney(claim, currency)}`} onClick={onClaim}>
          claim this rank for {formatMoney(claim, currency)}
        </button>
      )}
      <div
        className="listing-main"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("a, button")) onToggle();
        }}
      >
        <span className="listing-rank">{r.rank ? `#${r.rank}` : "–"}</span>
        <Avatar avatar={r.avatar} />
        <div className="listing-body">
          <div className="listing-name-row">
            {home ? (
              <a className="listing-name" href={`/go/${r.id}?to=${home[0]}`} target="_blank" rel="noopener">
                {r.name}
                <svg className="listing-name-out" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="visually-hidden"> (opens {home[1]} in a new tab)</span>
              </a>
            ) : (
              <button type="button" className="listing-name" {...toggle}>
                {r.name}
              </button>
            )}
            {r.verified && <VerifiedBadge />}
          </div>
          <p className="listing-meta">
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="dot" aria-hidden="true">
                    ·
                  </span>
                )}
                {m}
              </span>
            ))}
          </p>
        </div>
        {/* The whole card opens with a click; this is its button for keyboards and screen readers. */}
        <button type="button" className="listing-amount" {...toggle}>
          <span className="visually-hidden">
            {open ? "Close" : "Open"} {r.name}:{" "}
          </span>
          {r.total ? <span className="listing-total">{formatMoney(r.total, currency)}</span> : <span className="listing-none">No bids yet</span>}
          <span className="tag">{r.rank ? "Sponsored" : "Unranked"}</span>
        </button>
      </div>
      {open && (
        <>
          <ListingLocation listingId={r.id} name={r.name} location={r.location} here={here} />
          <div className="listing-panel" id={`bid-${r.id}`}>
            {children}
          </div>
        </>
      )}
    </li>
  );
}
