"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BoardProps, BoardRow } from "@/lib/board-view";
import { priceToPass } from "@/lib/ranking";
import { BidPanel } from "./BidPanel";
import { pollBid } from "./board/bid-client";
import { ClaimHeadline, type CustomAmount, type NewBusinessClaim } from "./board/ClaimHeadline";
import { ListingCard } from "./board/ListingCard";
import { MiniBoard } from "./board/MiniBoard";
import { NewBusinessPanel } from "./board/NewBusinessPanel";
import { ShareCard } from "./board/ShareCard";
import { useHere } from "./board/useHere";
import { Countdown } from "./Countdown";

type Open = { id: string; amount?: number; nonce: number; focus: boolean };
type NewBusiness = NewBusinessClaim & { amount: number; nonce: number };

const WHEN = { ALL_TIME: "", DAILY: "today's ", WEEKLY: "this week's " } as const;

export function BoardView(props: BoardProps & { pickers?: React.ReactNode }) {
  const { rows, topN, currency, title, slugs, period, periods, basePath, other, pickers } = props;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [custom, setCustom] = useState<CustomAmount | null>(null);
  const [pointedId, setPointedId] = useState<string | null>(null); // the card under the mouse or keyboard focus
  const [open, setOpen] = useState<Open | null>(null);
  const [newBusiness, setNewBusiness] = useState<NewBusiness | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const location = useHere();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // Back from a Stripe redirect: ?bid=<id>
  const returnedBid = search.get("bid");
  useEffect(() => {
    if (!returnedBid) return;
    pollBid(returnedBid).then((outcome) => {
      setToast(outcome.message);
      const rest = new URLSearchParams(window.location.search);
      rest.delete("bid");
      router.replace(`${pathname}${rest.size ? `?${rest}` : ""}`, { scroll: false });
      router.refresh();
    });
  }, [returnedBid, pathname, router]);

  // "Claim rank" opens the panel away from the headline, so bring it into view.
  useEffect(() => {
    if (!open?.focus) return;
    const heading = document.getElementById(`bid-title-${open.id}`);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading?.closest(".listing")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    heading?.focus({ preventScroll: true });
  }, [open]);

  // A category picked in the claim bar opens its board in this city, for the same period, keeping the owner's link.
  const categoryHref = (slug: string, link: string) => {
    const params = new URLSearchParams(period.href.split("?")[1] ?? "");
    if (link) params.set("link", link);
    return `/${slugs.city}/${slug}${params.size ? `?${params}` : ""}`;
  };

  const boardName = `${title.city} · ${title.category}`;
  const when = WHEN[period.type];
  const addHref = `/add?city=${slugs.city}&category=${slugs.category}`;
  const ranked = rows.filter((r) => r.rank !== null);
  // "claim this rank for …" sits on the card being pointed at, else on #1, priced for whoever the headline
  // is claiming for (the business picked below, or a new one): that card's total + one step. The
  // headline previews the same rank and price.
  const priceFor = (id: string) => priceToPass(rows, chosenId, id, props.step, props.minBid);
  const preview = pointedId ? priceFor(pointedId) : null;
  const pillId = preview !== null ? pointedId : (ranked[0]?.id ?? null);
  const pill = pillId ? priceFor(pillId) : null;
  const top = ranked.slice(0, topN);
  const more = ranked.slice(topN);
  const unranked = rows.filter((r) => r.rank === null);

  const card = (r: BoardRow) => (
    <ListingCard
      key={r.id}
      row={r}
      category={title.category}
      currency={currency}
      claim={r.id === pillId ? pill : null}
      here={location.here}
      open={open?.id === r.id}
      onToggle={() => {
        if (open?.id === r.id) return setOpen(null);
        setOpen({ id: r.id, nonce: Date.now(), focus: false });
        setNewBusiness(null);
        setChosenId(r.id);
      }}
      onPoint={() => setPointedId(r.id)}
      onClaim={() => {
        if (pill === null) return;
        setCustom({ id: chosenId, amount: pill });
        if (chosenId) {
          // The business picked below pays to move up: open its bid panel at this price.
          setNewBusiness(null);
          setOpen({ id: chosenId, amount: pill, nonce: Date.now(), focus: true });
          return;
        }
        // A business that isn't on the board yet: the headline now shows this price; ask for its link.
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        linkRef.current?.closest(".claim")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        linkRef.current?.focus({ preventScroll: true });
      }}
    >
      {open?.id === r.id && (
        <BidPanel
          key={open.nonce}
          row={r}
          rows={rows}
          currency={currency}
          step={props.step}
          minBid={props.minBid}
          initialAmount={open.amount}
          onDone={(msg) => {
            setToast(msg);
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </ListingCard>
  );

  return (
    <div className="board">
      {pickers}

      <div className="board-period">
        {periods.length > 1 && (
          <nav className="seg" aria-label="Board period">
            {periods.map((p) => {
              const current = p.type === period.type;
              return (
                <Link key={p.type} href={p.href} aria-current={current ? "page" : undefined} scroll={false}>
                  {current && <span className="live-dot" aria-hidden="true" />}
                  {p.label}
                </Link>
              );
            })}
          </nav>
        )}
        <p className="board-period-note">
          {period.resets && period.endsAt ? (
            <>
              {period.resets} · <Countdown endsAt={period.endsAt} />
              {period.type === "DAILY" && (
                <>
                  {" · "}
                  <Link className="text-link" href={`${basePath}/past`}>
                    Past winners
                  </Link>
                </>
              )}
            </>
          ) : (
            "Bids add up for good. The highest total ranks first."
          )}
        </p>
      </div>

      <ClaimHeadline
        ref={linkRef}
        rows={rows}
        boardId={props.boardId}
        category={title.category}
        categories={props.categories}
        categorySlug={slugs.category}
        categoryHref={categoryHref}
        initialLink={search.get("link") ?? ""}
        when={when}
        currency={currency}
        step={props.step}
        minBid={props.minBid}
        chosenId={chosenId}
        custom={custom}
        onCustom={setCustom}
        preview={preview}
        onClaim={(id, amount) => {
          setNewBusiness(null);
          setChosenId(id);
          setOpen({ id, amount, nonce: Date.now(), focus: true });
        }}
        onClaimNew={(business, amount) => {
          setOpen(null);
          setChosenId(null);
          setNewBusiness({ ...business, amount, nonce: Date.now() });
        }}
      />

      {newBusiness && (
        <NewBusinessPanel
          key={newBusiness.nonce}
          boardId={props.boardId}
          boardName={boardName}
          link={newBusiness.link}
          suggestedName={newBusiness.name}
          online={newBusiness.online}
          avatar={newBusiness.avatar}
          rows={rows}
          currency={currency}
          step={props.step}
          minBid={props.minBid}
          initialAmount={newBusiness.amount}
          city={{ slug: slugs.city, name: title.city, center: props.cityCenter }}
          onChangeLink={() => {
            setNewBusiness(null);
            linkRef.current?.focus();
          }}
          onDone={(msg) => {
            setToast(msg);
            setNewBusiness(null);
            router.refresh();
          }}
        />
      )}

      <p className="board-note">
        <span className="tag">Sponsored</span>
        <span>Order is set by total amount paid, not by quality.</span>
        <Link className="board-note-link" href={addHref}>
          Not on the board? Add it free
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={sharing} aria-controls="share-board" onClick={() => setSharing((s) => !s)}>
          Share board
        </button>
        {location.status === "on" ? (
          <span className="distance-control">
            <span className="distance-note">Distances from your location</span>
            <button type="button" className="link-btn" onClick={location.stop}>
              Hide
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={location.ask} disabled={location.status === "asking"}>
            <span className="location-pin" aria-hidden="true" />
            {location.status === "asking" ? "Finding you…" : "Distance from me"}
          </button>
        )}
      </p>
      {(location.status === "denied" || location.status === "unavailable") && (
        <p className="distance-note board-note-alert" role="status">
          {location.status === "denied"
            ? "Location access is blocked. Allow it for this site in your browser settings to see distances."
            : "We couldn't get your location. Try again, or check that location is turned on."}
        </p>
      )}

      <div className="board-layout">
        {sharing && (
          <ShareCard
            id="share-board"
            path={period.href}
            boardName={boardName}
            when={when}
            rows={rows}
            currency={currency}
            onClose={() => setSharing(false)}
          />
        )}

        <div
          className="board-main"
          onPointerLeave={() => setPointedId(null)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setPointedId(null);
          }}
        >
          {rows.length === 0 ? (
            <p className="board-empty">
              No businesses on {boardName} yet. <Link href={addHref}>Add the first one free</Link>.
            </p>
          ) : (
            <>
              {top.length > 0 && (
                <ol className="board-list" aria-label={`${title.city} ${title.category}, ranked by bids`}>
                  {top.map(card)}
                </ol>
              )}
              {more.length > 0 && (
                <>
                  <h2 className="board-list-label">More ranked businesses</h2>
                  <ol className="board-list" start={topN + 1}>
                    {more.map(card)}
                  </ol>
                </>
              )}
              {unranked.length > 0 && (
                <>
                  <h2 className="board-list-label">No bids yet</h2>
                  <ul className="board-list">{unranked.map(card)}</ul>
                </>
              )}
            </>
          )}
        </div>

        <aside className="board-aside" aria-label="More on this board">
          {other && <MiniBoard board={other} currency={currency} />}
          <p className="board-aside-note">
            Own one of these businesses? Open it and choose <b>Verify it</b> to get a Verified badge. No account needed.
          </p>
        </aside>
      </div>

      <div className="toast-region" role="status" aria-live="polite">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}
