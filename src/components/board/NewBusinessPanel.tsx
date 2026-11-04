"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardRow } from "@/lib/board-view";
import { displayLink, formatFollowers } from "@/lib/business-link";
import { formatMoney } from "@/lib/money";
import type { OnlineCheck } from "@/lib/online-check";
import { AmountFields, amountOptions, BidderFields, TermsAndPay } from "../BidPanel";
import { distanceKm, type LatLng, type Place } from "@/lib/geo";
import { CITY_RADIUS_KM, LocationPicker } from "../map/LocationPicker";
import { useCheckout } from "./useCheckout";

type Props = {
  boardId: string;
  boardName: string; // "Surat · Cafes"
  link: string; // normalised link pasted into the claim bar
  suggestedName: string; // from the profile or site found online
  online: OnlineCheck;
  avatar: string | null; // profile picture or site icon, from /api/listings/avatar
  rows: BoardRow[];
  currency: string;
  step: number;
  minBid: number;
  initialAmount: number; // minor units, from the claim headline
  city: { slug: string; name: string; center: LatLng | null };
  onChangeLink: () => void;
  onDone: (msg: string) => void;
};

/**
 * A business that isn't on the board yet, from a link pasted into the claim bar.
 * It is added with its first bid and goes live once the payment is confirmed.
 */
export function NewBusinessPanel(props: Props) {
  const { rows, currency, step, minBid } = props;
  const [name, setName] = useState(props.suggestedName);
  const [amount, setAmount] = useState<number | "">(props.initialAmount / 100);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [location, setLocation] = useState<Place | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { busy, error, pay } = useCheckout(props.onDone);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.closest(".new-biz")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    el.focus({ preventScroll: true });
  }, []);

  const minor = typeof amount === "number" ? Math.round(amount * 100) : 0;
  const valid = minor >= minBid;
  const inCity = !!location && (!props.city.center || distanceKm(location, props.city.center) <= CITY_RADIUS_KM);
  const canPay = valid && agreed && email.includes("@") && name.trim().length > 0 && inCity && !busy;
  const id = (field: string) => `new-biz-${field}`;

  return (
    <section className="new-biz card" aria-labelledby={id("title")}>
      <div className="bid-head">
        <div className="new-biz-head">
          {props.avatar && !avatarFailed && (
            <img className="new-biz-avatar" src={props.avatar} alt="" width={56} height={56} onError={() => setAvatarFailed(true)} />
          )}
          <div>
            <p className="eyebrow">New on {props.boardName}</p>
            <h2 className="bid-title" id={id("title")}>
              Add your business and claim your spot
            </h2>
          </div>
        </div>
        <p className="new-biz-link">
          <a className="text-link" href={props.link} target="_blank" rel="noopener noreferrer">
            {displayLink(props.link)}
          </a>
          {props.online.status === "found" ? (
            <span className="new-biz-found">
              ✓ {props.online.platform === "Website" ? "Website is online" : `Found on ${props.online.platform}`}
              {props.online.followers !== null && ` · ${formatFollowers(props.online.followers)}`}
            </span>
          ) : (
            <span className="muted">Not confirmed yet. Our team will check it.</span>
          )}
          <button type="button" className="link-btn" onClick={props.onChangeLink}>
            Change
          </button>
        </p>
      </div>

      <form
        className="bid-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPay) {
            pay({
              newBusiness: { boardId: props.boardId, name: name.trim(), link: props.link, location },
              amount: minor / 100,
              email,
              displayName: displayName || null,
              acceptedTerms: agreed,
            });
          }
        }}
      >
        <div className="field">
          <label htmlFor={id("name")}>Business name</label>
          <input ref={nameRef} id={id("name")} type="text" maxLength={80} placeholder="e.g. Monsoon Beans" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <LocationPicker value={location} onChange={setLocation} city={props.city} required />
        <AmountFields id={id} options={amountOptions(rows, null, step, minBid)} amount={amount} minor={minor} minBid={minBid} currency={currency} onChange={setAmount} />
        <BidderFields id={id} email={email} displayName={displayName} onEmail={setEmail} onName={setDisplayName} />
        <TermsAndPay
          agreed={agreed}
          onAgree={setAgreed}
          error={error}
          busy={busy}
          canPay={canPay}
          label={valid ? `Pay ${formatMoney(minor, currency)} with UPI or card` : "Pay with UPI or card"}
          note={
            location
              ? `Minimum ${formatMoney(minBid, currency)}. Your business goes live on the board once the payment is confirmed.`
              : "Add your business location above to continue."
          }
        />
      </form>
    </section>
  );
}
