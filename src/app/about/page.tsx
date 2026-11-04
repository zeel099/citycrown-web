import Link from "next/link";
import { zoneLabel } from "@/lib/board-view";
import { formatMoney } from "@/lib/money";
import { SITE_TIME_ZONE } from "@/lib/site";
import { siteStats } from "@/lib/site-stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About",
  description: "Why Best in the City ranks local businesses by money, in public, and the live numbers since launch.",
};

/** "₹2,67,677" with the currency sign in coral. */
function StatMoney({ text }: { text: string }) {
  const [, sign, amount] = text.match(/^(\D*)(.*)$/)!;
  return (
    <>
      {sign && <span className="stat-currency">{sign}</span>}
      {amount}
    </>
  );
}

export default async function AboutPage() {
  const s = await siteStats();
  const money = (minor: number) => formatMoney(minor, s.currency);
  const count = (n: number) => n.toLocaleString("en-IN");
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: SITE_TIME_ZONE });
  const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: SITE_TIME_ZONE });

  return (
    <div className="inner page about">
      <h1 className="h1 page-title">About</h1>
      <p className="about-text">
        Best in the City started with <Link href="/rules">one simple rule</Link>: a public board for every city and category, ranked by
        money, and honest about it. No ads, no reviews to game, no hidden algorithm. Just claim #1.
      </p>

      <h2 className="about-h2">Then it went live</h2>
      {s.launched && (
        <p className="about-text">
          The site went live on {day.format(s.launched)}, at {time.format(s.launched)} {zoneLabel(SITE_TIME_ZONE, s.launched)}.
        </p>
      )}
      <p className="about-text">Here&apos;s what has happened since, live from the boards:</p>

      <ul className="stats" id="stats">
        <li className="stat">
          <span className="stat-value">
            <span className="stat-dot" aria-hidden="true" />
            {count(s.visitors)}
          </span>
          <span className="stat-label">visitors · {count(s.online)} online now</span>
        </li>
        <li className="stat">
          <span className="stat-value"><StatMoney text={money(s.raised)} /></span>
          <span className="stat-label">bid in total</span>
        </li>
        <li className="stat">
          <span className="stat-value"><StatMoney text={s.highest ? money(s.highest.total) : "–"} /></span>
          <span className="stat-label">
            highest total (so far)
            {s.highest && (
              <>
                {" · "}
                <Link href={s.highest.href} title={s.highest.board}>
                  {s.highest.name}
                </Link>
              </>
            )}
          </span>
        </li>
        <li className="stat">
          <span className="stat-value">{count(s.listed)}</span>
          <span className="stat-label">businesses listed</span>
        </li>
        <li className="stat">
          <span className="stat-value">{count(s.addedToday)}</span>
          <span className="stat-label">businesses added today</span>
        </li>
        <li className="stat">
          <span className="stat-value"><StatMoney text={money(s.raisedToday)} /></span>
          <span className="stat-label">
            bid today · {count(s.bidsToday)} {s.bidsToday === 1 ? "bid" : "bids"}
          </span>
        </li>
      </ul>

      <h2 className="about-h2">Why bids, not reviews</h2>
      <p className="about-text">
        Reviews can be bought quietly. Here the money is the ranking, and everyone can see it. Every ranked spot is labelled Sponsored,
        and the price to pass any business is shown right on the board.
      </p>

      <h2 className="about-h2">How a day works</h2>
      <p className="about-text">
        Each city and category has an All-time board, where bids add up for good, and a Today board that resets at midnight{" "}
        {zoneLabel(SITE_TIME_ZONE)}. Every finished day keeps its final ranking on the Daily page.
      </p>

      <p className="about-actions">
        <Link className="btn btn-primary" href="/daily">
          See today&apos;s ranking
        </Link>
        <Link className="btn btn-secondary" href="/rules">
          Read the rules
        </Link>
      </p>
    </div>
  );
}
