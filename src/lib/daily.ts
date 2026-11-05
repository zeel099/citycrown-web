import type { Listing } from "@prisma/client";
import { avatarUrls } from "./avatars";
import { avatarFor, timeAgo, type Avatar } from "./board-view";
import { shortLink } from "./business-link";
import { db } from "./db";
import { clickCounts } from "./load-board";
import { rankListings } from "./ranking";
import { periodBounds, startOfLocalDay } from "./time";

// The Daily page: each day in a city is one ranking across all its categories, by what each
// business bid that day on its All-time and Today boards together. Today is live until
// midnight; earlier days are closed.

const DAYS_SHOWN = 30; // today and the 29 days before it

/** One business on a day's ranking. to: which of its links the short link opens (through /go). */
export type DayRow = {
  id: string;
  name: string;
  rank: number;
  total: number;
  bids: number;
  category: { slug: string; name: string };
  board: "ALL_TIME" | "DAILY"; // where its bids that day went: Today only, or (also) All-time
  link: { label: string; to: "website" | "instagram" | "facebook" } | null;
  lastBid: string; // "2 hours ago"
  clicks: number;
  verified: boolean;
  avatar: Avatar;
};

export type Day = { startsAt: Date; endsAt: Date; live: boolean; total: number; bids: number; rows: DayRow[] };

type DayListing = Pick<Listing, "id" | "name" | "createdAt" | "websiteUrl" | "instagramUrl" | "facebookUrl" | "verifiedAt">;

function linkOf(l: DayListing): DayRow["link"] {
  if (l.websiteUrl) return { label: shortLink(l.websiteUrl), to: "website" };
  if (l.instagramUrl) return { label: shortLink(l.instagramUrl), to: "instagram" };
  if (l.facebookUrl) return { label: shortLink(l.facebookUrl), to: "facebook" };
  return null;
}

// A business is listed once per board (All-time and Today) of its city and category.
const businessKey = (categoryId: string, normalizedName: string) => `${categoryId}|${normalizedName}`;

/**
 * Today (always, even with no bids yet) and the earlier days of the last DAYS_SHOWN that had
 * bids, newest first. since: the first day anything was bid in this city.
 */
export async function cityDays(city: { id: string; timeZone: string }, now = new Date()) {
  const today = periodBounds("DAILY", now, city.timeZone);
  const from = startOfLocalDay(new Date(today.startsAt.getTime() - (DAYS_SHOWN - 1) * 864e5), city.timeZone);
  const boards = { cityId: city.id, active: true, category: { active: true, banned: false } };
  const shown = { status: { notIn: ["REMOVED" as const, "REJECTED" as const] } };
  const confirmed = { status: "CONFIRMED" as const, listing: { ...shown, board: boards } };
  const [bids, first, categories] = await Promise.all([
    db.bid.findMany({
      where: { ...confirmed, confirmedAt: { gte: from } },
      select: {
        amount: true,
        confirmedAt: true,
        period: { select: { startsAt: true } },
        listing: { select: { normalizedName: true, board: { select: { type: true, categoryId: true } } } },
      },
    }),
    db.bid.findFirst({ where: confirmed, orderBy: { confirmedAt: "asc" }, select: { confirmedAt: true } }),
    db.category.findMany({
      where: { active: true, banned: false, boards: { some: { ...boards, type: "DAILY" } } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  // The business's listings on every board, for its name, links, picture and clicks.
  const listings = await db.listing.findMany({
    where: { ...shown, board: { cityId: city.id }, normalizedName: { in: [...new Set(bids.map((b) => b.listing.normalizedName))] } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      websiteUrl: true,
      instagramUrl: true,
      facebookUrl: true,
      verifiedAt: true,
      normalizedName: true,
      board: { select: { type: true, categoryId: true, category: { select: { slug: true, name: true } } } },
    },
  });
  const ids = listings.map((l) => l.id);
  const [clicks, pictures] = await Promise.all([clickCounts(ids), avatarUrls(ids)]);
  const businesses = new Map<string, { listing: (typeof listings)[number]; ids: string[] }>();
  for (const l of listings) {
    const key = businessKey(l.board.categoryId, l.normalizedName);
    const b = businesses.get(key);
    if (!b) businesses.set(key, { listing: l, ids: [l.id] });
    else {
      b.ids.push(l.id);
      if (l.board.type === "ALL_TIME") b.listing = l; // the All-time listing speaks for the business
    }
  }

  type Entry = DayListing & { key: string; total: number; reachedAt: Date | null; bids: number; allTime: boolean };
  const days = new Map<number, { startsAt: Date; endsAt: Date; entries: Map<string, Entry> }>();
  const dayOf = (startsAt: Date) => {
    const key = startsAt.getTime();
    if (!days.has(key)) days.set(key, { startsAt, endsAt: periodBounds("DAILY", startsAt, city.timeZone).endsAt!, entries: new Map() });
    return days.get(key)!;
  };
  dayOf(today.startsAt);
  for (const bid of bids) {
    const key = businessKey(bid.listing.board.categoryId, bid.listing.normalizedName);
    const business = businesses.get(key);
    if (!business || !bid.confirmedAt) continue;
    // A Today bid belongs to its board's day; an All-time bid to the day it was paid.
    const allTime = bid.listing.board.type === "ALL_TIME";
    const day = dayOf(allTime ? startOfLocalDay(bid.confirmedAt, city.timeZone) : bid.period.startsAt);
    const entry = day.entries.get(key) ?? { ...business.listing, key, total: 0, reachedAt: null, bids: 0, allTime: false };
    entry.total += bid.amount;
    entry.bids += 1;
    entry.allTime ||= allTime;
    if (!entry.reachedAt || bid.confirmedAt > entry.reachedAt) entry.reachedAt = bid.confirmedAt;
    day.entries.set(key, entry);
  }

  const result: Day[] = [...days.values()]
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .map((d) => {
      const ranked = rankListings([...d.entries.values()]).filter((l) => l.rank !== null);
      return {
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        live: d.startsAt.getTime() === today.startsAt.getTime(),
        total: ranked.reduce((n, l) => n + l.total, 0),
        bids: ranked.reduce((n, l) => n + l.bids, 0),
        rows: ranked.map((l) => {
          const business = businesses.get(l.key)!;
          return {
            id: l.id,
            name: l.name,
            rank: l.rank!,
            total: l.total,
            bids: l.bids,
            category: business.listing.board.category,
            board: l.allTime ? ("ALL_TIME" as const) : ("DAILY" as const),
            link: linkOf(l),
            lastBid: timeAgo(l.reachedAt ?? now, now),
            clicks: business.ids.reduce((n, id) => n + (clicks.get(id) ?? 0), 0),
            verified: l.verifiedAt !== null,
            avatar: avatarFor(l.name, business.ids.map((id) => pictures.get(id)).find(Boolean)),
          };
        }),
      };
    });

  return { today: result[0], past: result.slice(1).filter((d) => d.rows.length > 0), since: first?.confirmedAt ?? null, categories };
}
