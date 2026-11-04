"use client";

import Link from "next/link";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { BoardRow } from "@/lib/board-view";
import { displayLink, formatFollowers, LINK_HELP, linkCandidates } from "@/lib/business-link";
import { formatMoney } from "@/lib/money";
import type { OnlineCheck } from "@/lib/online-check";
import { bidShortcuts, priceToTop, rankAfterBid } from "@/lib/ranking";
import { DetailsMenu } from "../DetailsMenu";

/** avatar: our /api/listings/avatar URL for the profile picture or site icon, when there is one. */
export type NewBusinessClaim = { link: string; name: string; online: OnlineCheck; avatar: string | null };

/** An amount picked for the business being claimed (id null: one that isn't on the board yet). */
export type CustomAmount = { id: string | null; amount: number };

type Props = {
  rows: BoardRow[];
  boardId: string;
  category: string;
  categories: { slug: string; name: string }[]; // the owner picks theirs; each is its own board
  categorySlug: string;
  categoryHref: (slug: string, link: string) => string; // that category's board here, keeping the typed link
  initialLink: string; // carried over from another category's claim bar
  when: string; // "" or "today's "
  currency: string;
  step: number;
  minBid: number;
  chosenId: string | null; // a business picked on the board below
  custom: CustomAmount | null; // set with the stepper, or by a card's "claim this rank"
  onCustom: (custom: CustomAmount) => void;
  preview: number | null; // the price of the rank being pointed at on the board, shown while it is
  onClaim: (id: string, amount: number) => void;
  onClaimNew: (business: NewBusinessClaim, amount: number) => void;
};

/** What the pasted link turned out to be, checked as the owner types. */
type Check =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking"; input: string }
  | { state: "existing"; link: string; listing: { id: string; name: string }; avatar: string | null }
  | { state: "new"; link: string; business: NewBusinessClaim }
  | { state: "missing"; link: string; message: string };

const DEBOUNCE_MS = 800;
const MIN_CHARS = 3; // don't check half-typed handles like "ra"

/** Price for a business to take #1 (or its next rank up, if it already leads), never below the minimum bid. */
function startAmount(rows: BoardRow[], id: string | null, step: number, minBid: number) {
  if (!id) return priceToTop(rows, step, minBid);
  const shortcuts = bidShortcuts(rows, id, step, minBid);
  return (shortcuts.find((s) => s.rank === 1) ?? shortcuts[0])?.amount ?? minBid;
}

/** Sends what was typed as-is: the server decides whether "raj.sojitra17" is a handle or a website. */
async function lookup(boardId: string, input: string, signal?: AbortSignal): Promise<Check> {
  try {
    const res = await fetch(`/api/listings/lookup?board=${encodeURIComponent(boardId)}&link=${encodeURIComponent(input)}`, { signal });
    const data = await res.json();
    if (data.listing) return { state: "existing", link: input, listing: data.listing, avatar: data.avatar ?? null };
    if (data.newBusiness) {
      return { state: "new", link: data.newBusiness.link, business: { ...data.newBusiness, online: data.online, avatar: data.avatar ?? null } };
    }
    return { state: "missing", link: input, message: data.error ?? "Something went wrong. Try again." };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { state: "missing", link: input, message: "We couldn't check that link. Check your connection and try again." };
  }
}

/**
 * "Claim #1 in Cafes for − ₹5,020 +" (FR-BID-03). Owners paste their Instagram
 * handle, Facebook page or website; it's checked online as they type, and only a
 * business already on the board or a real account or site can claim a rank.
 */
export const ClaimHeadline = forwardRef<HTMLInputElement, Props>(function ClaimHeadline(props, linkRef) {
  const { rows, chosenId, custom, preview, step, minBid, currency, boardId } = props;
  const [text, setText] = useState(props.initialLink);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const pending = useRef<{ input: string; promise: Promise<Check> } | null>(null);

  const chosen = rows.find((r) => r.id === chosenId) ?? null;
  const customised = custom && custom.id === chosenId ? custom.amount : null;
  const amount = preview ?? customised ?? startAmount(rows, chosen?.id ?? null, step, minBid);
  const rank = rankAfterBid(rows, chosen?.id ?? null, amount);
  const verb = chosen?.rank === rank ? "Keep" : rank === 1 ? "Claim" : "Reach";
  const stepLabel = formatMoney(step, currency);
  const set = (next: number) => props.onCustom({ id: chosenId, amount: Math.max(minBid, next) });

  // Check the link online once the owner stops typing.
  useEffect(() => {
    const value = text.trim();
    if (!value) {
      pending.current = null;
      setCheck({ state: "idle" });
      return;
    }
    const valid = linkCandidates(value).length > 0;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!valid) return setCheck({ state: "invalid" });
      if (value.replace(/^@/, "").length < MIN_CHARS) return setCheck({ state: "idle" });
      setCheck({ state: "checking", input: value });
      const promise = lookup(boardId, value, controller.signal);
      pending.current = { input: value, promise };
      promise.then(setCheck, () => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, boardId]);

  const ready = check.state === "existing" || check.state === "new";
  const avatar = check.state === "existing" ? check.avatar : check.state === "new" ? check.business.avatar : null;
  const canClaim = text.trim() ? ready || check.state === "checking" : !!chosen;

  function proceed(result: Check) {
    if (result.state === "existing") props.onClaim(result.listing.id, customised ?? startAmount(rows, result.listing.id, step, minBid));
    if (result.state === "new") props.onClaimNew(result.business, customised ?? priceToTop(rows, step, minBid));
  }

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      if (chosen) props.onClaim(chosen.id, amount);
      return;
    }
    if (ready) return proceed(check);
    // Pressed before the check finished: wait for it.
    if (pending.current?.input === text.trim()) proceed(await pending.current.promise.catch(() => ({ state: "idle" }) as Check));
  }

  return (
    <section className="claim" aria-label="Claim a rank">
      <h1 className="display claim-title">
        <span>
          {verb} {props.when}#{rank} in {props.category} for
        </span>{" "}
        <span className="stepper claim-stepper">
          <button type="button" aria-label={`Lower by ${stepLabel}`} disabled={amount - step < minBid} onClick={() => set(amount - step)}>
            −
          </button>
          <output className="stepper-value" aria-live="polite">
            {formatMoney(amount, currency)}
          </output>
          <button type="button" aria-label={`Raise by ${stepLabel}`} onClick={() => set(amount + step)}>
            +
          </button>
        </span>
      </h1>
      <form className="claim-form" onSubmit={claim} noValidate>
        <label className="visually-hidden" htmlFor="claim-link">
          Your business link
        </label>
        <span className={`claim-link is-${check.state}`}>
          {avatar && <LinkAvatar key={avatar} src={avatar} />}
          <input
            ref={linkRef}
            id="claim-link"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={300}
            placeholder="Paste your Instagram handle, Facebook page or website"
            value={text}
            aria-invalid={check.state === "missing" || check.state === "invalid" ? true : undefined}
            aria-describedby="claim-help"
            onChange={(e) => setText(e.target.value)}
          />
        </span>
        <CategoryMenu categories={props.categories} current={props.categorySlug} href={(slug) => props.categoryHref(slug, text.trim())} />
        <button type="submit" className="btn btn-primary claim-btn" disabled={!canClaim}>
          {check.state === "checking" ? "Checking…" : "Claim rank"}
        </button>
      </form>
      <ClaimStatus check={check} />
    </section>
  );
});

type CategoryMenuProps = { categories: { slug: string; name: string }[]; current: string; href: (slug: string) => string };

/** The owner's business category. Each choice opens that category's board in this city, with the link typed so far. */
function CategoryMenu({ categories, current, href }: CategoryMenuProps) {
  const name = categories.find((c) => c.slug === current)?.name ?? current;
  return (
    <DetailsMenu className="claim-category">
      <summary aria-label={`Business category: ${name}. Change category`}>
        <span className="claim-category-hint">Category</span>
        <span className="claim-category-name">{name}</span>
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul className="city-menu-list">
        {categories.map((c) => (
          <li key={c.slug}>
            {c.slug === current ? (
              <span aria-current="true">{c.name}</span>
            ) : (
              <Link href={href(c.slug)} scroll={false}>
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </DetailsMenu>
  );
}

function ClaimStatus({ check }: { check: Check }) {
  let tone = "";
  let message: React.ReactNode;
  switch (check.state) {
    case "idle":
      message = "We check it's a real account or site. Already on the board? Your bid adds to its total. New? You're added as soon as you pay.";
      break;
    case "invalid":
      tone = "is-bad";
      message = LINK_HELP;
      break;
    case "checking":
      tone = "is-checking";
      message = `Checking ${check.input} online…`;
      break;
    case "existing":
      tone = "is-good";
      message = (
        <>
          <Tick /> <b>{check.listing.name}</b> is on this board. Claim rank to add to its total.
        </>
      );
      break;
    case "new": {
      const { online } = check.business;
      if (online.status === "found") {
        tone = "is-good";
        message = (
          <>
            <Tick /> {online.platform === "Website" ? "Website is online" : `Found on ${online.platform}`}
            {online.name ? (
              <>
                : <b>{online.name}</b>
              </>
            ) : (
              `: ${displayLink(check.link)}`
            )}
            {online.followers !== null && <> · {formatFollowers(online.followers)}</>}. Claim rank to add it to the board.
          </>
        );
      } else {
        tone = "is-warn";
        message = online.status === "unknown" ? online.message : "";
      }
      break;
    }
    case "missing":
      tone = "is-bad";
      message = check.message;
      break;
  }
  return (
    <p className={`claim-help ${tone}`} id="claim-help" role="status" aria-live="polite">
      {message}
    </p>
  );
}

/** The profile picture or site icon, inside the box at the start of the link. Hidden if it fails to load. */
function LinkAvatar({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="claim-avatar" src={src} alt="" width={30} height={30} onError={() => setFailed(true)} />;
}

function Tick() {
  return (
    <svg className="claim-tick" viewBox="0 0 10 10" aria-hidden="true">
      <rect width="10" height="10" rx="2.5" fill="currentColor" />
      <path d="M2.7 5.2 4.3 6.8 7.3 3.6" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
