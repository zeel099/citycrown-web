import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CityMenu } from "@/components/CityMenu";
import { Countdown } from "@/components/Countdown";
import { Avatar } from "@/components/board/Avatar";
import { VerifiedBadge } from "@/components/board/VerifiedBadge";
import { zoneLabel } from "@/lib/board-view";
import { cityDays, type Day, type DayRow } from "@/lib/daily";
import { formatMoney } from "@/lib/money";
import { cityForPage, DEFAULT_BOARD } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city?: string[] }> };

const CLOSED_ROWS = 10; // a closed day shows its top ten

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await cityForPage((await params).city);
  if (!page) return {};
  return {
    title: `Daily: ${page.city.name}`,
    description: `Every day in ${page.city.name} gets its own ranking: the businesses that bid the most that day, across every category.`,
  };
}

/** Each day in a city as one ranking across its categories' Today boards; today is live until midnight. */
export default async function DailyPage({ params }: Props) {
  const page = await cityForPage((await params).city);
  if (!page) notFound();
  const { city, cities } = page;
  const { today, past, since, categories } = await cityDays(city);
  const zone = zoneLabel(city.timeZone);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: city.timeZone });

  return (
    <div className="inner page">
      <div className="page-head">
        <h1 className="h1 page-title">Daily</h1>
        <CityMenu cities={cities} current={city.slug} href={(slug) => `/daily/${slug}`} />
      </div>
      <p className="lead page-lead">
        Every day{since ? ` since ${date.format(since)}` : ""} gets its own ranking in {city.name}. Rank is what a business bid that day,
        on its All-time and Today boards together. Today stays live until midnight {zone}, then the day closes.
      </p>

      <DayCard day={today} title={date.format(today.startsAt)} currency={city.currency} citySlug={city.slug} zone={zone}>
        {today.rows.length === 0 && (
          <p className="day-empty">
            No bids yet today. The first bid on any {city.name} board takes today&apos;s #1.{" "}
            <Link href={`/${city.slug}/${DEFAULT_BOARD.category}?period=today`}>Claim it</Link>.
          </p>
        )}
        <div className="day-claim">
          <p>Claim a spot today on your category&apos;s board:</p>
          <ul className="day-claim-list">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/${city.slug}/${c.slug}?period=today`}>
                  <CategoryIcon slug={c.slug} />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </DayCard>

      {past.map((d) => (
        <DayCard key={d.startsAt.toISOString()} day={d} title={date.format(d.startsAt)} currency={city.currency} citySlug={city.slug} zone={zone} />
      ))}
      {past.length === 0 && <p className="page-note">Finished days show here after midnight, with their final ranking.</p>}
    </div>
  );
}

type DayCardProps = { day: Day; title: string; currency: string; citySlug: string; zone: string; children?: React.ReactNode };

function DayCard({ day, title, currency, citySlug, zone, children }: DayCardProps) {
  const rows = day.live ? day.rows : day.rows.slice(0, CLOSED_ROWS);
  const more = day.rows.length - rows.length;
  const id = `day-${day.startsAt.getTime()}`;
  return (
    <section className={`day card${day.live ? " is-live" : ""}`} aria-labelledby={id}>
      <div className="day-head">
        <h2 className="day-title" id={id}>
          {title}
          {day.live ? (
            <span className="day-badge is-live">
              <span className="day-badge-dot" aria-hidden="true" />
              Live
            </span>
          ) : (
            <span className="day-badge">Closed</span>
          )}
        </h2>
        <p className="day-stats">
          {day.live && (
            <>
              <Countdown endsAt={day.endsAt.toISOString()} /> ·{" "}
            </>
          )}
          {plural(day.rows.length, "listing")}
          {day.total > 0 && <> · {formatMoney(day.total, currency)} bid</>}
        </p>
      </div>
      {day.live && <p className="day-note">This day is still open for claims. It closes at midnight {zone}.</p>}
      {rows.length > 0 && (
        <ol className="day-rows">
          {rows.map((r) => (
            <DayListing key={r.id} row={r} currency={currency} href={boardHref(citySlug, r, day.live)} />
          ))}
        </ol>
      )}
      {more > 0 && <p className="day-more">and {plural(more, "more business", "more businesses")} that bid that day</p>}
      {children}
    </section>
  );
}

/** Where "see details" goes: the All-time board if the business bid there that day, else its Today board (or, for a closed day, that board's past winners). */
function boardHref(citySlug: string, r: DayRow, live: boolean) {
  const board = `/${citySlug}/${r.category.slug}`;
  if (r.board === "ALL_TIME") return board;
  return live ? `${board}?period=today` : `${board}/past`;
}

function DayListing({ row: r, currency, href }: { row: DayRow; currency: string; href: string }) {
  return (
    <li className={`day-row${r.rank === 1 ? " is-first" : ""}`}>
      <span className="day-rank">#{r.rank}</span>
      <Avatar avatar={r.avatar} />
      <div className="day-body">
        <p className="day-name">
          <Link href={href}>{r.name}</Link>
          {r.verified && <VerifiedBadge />}
        </p>
        <p className="day-meta">
          <Link className="day-category" href={href}>
            <CategoryIcon slug={r.category.slug} />
            {r.category.name}
          </Link>
          <span>last bid {r.lastBid}</span>
          {r.link && (
            <a href={`/go/${r.id}?to=${r.link.to}`} target="_blank" rel="noopener">
              {r.link.label}
            </a>
          )}
          <span className="day-extra">{plural(r.clicks, "click")}</span>
          <Link className="day-extra" href={href}>
            see details
          </Link>
        </p>
      </div>
      <span className="day-total">{formatMoney(r.total, currency)}</span>
    </li>
  );
}
