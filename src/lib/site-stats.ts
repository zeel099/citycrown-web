import { db } from "./db";
import { SITE_TIME_ZONE, todayStats } from "./site";
import { startOfLocalDay } from "./time";
import { liveCounts } from "./visits";

// The About page's numbers, all live from the database. Money is in rupees: every launch city is in India.

const CONFIRMED = { status: "CONFIRMED" as const, currency: "INR" };
const LISTED = { status: "LIVE" as const, board: { type: "ALL_TIME" as const } }; // one per business (its Today listing is a copy)

/** When the site went live: SITE_LAUNCHED_AT if set (an ISO date), else the first confirmed bid. */
async function launchedAt(): Promise<Date | null> {
  const set = process.env.SITE_LAUNCHED_AT ? new Date(process.env.SITE_LAUNCHED_AT) : null;
  if (set && !Number.isNaN(set.getTime())) return set;
  const first = await db.bid.findFirst({ where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "asc" }, select: { confirmedAt: true } });
  return first?.confirmedAt ?? null;
}

export async function siteStats(now = new Date()) {
  const since = startOfLocalDay(now, SITE_TIME_ZONE);
  const [visitors, live, raised, today, listed, addedToday, [leader], launched] = await Promise.all([
    db.visit.count(),
    liveCounts(now),
    db.bid.aggregate({ where: CONFIRMED, _sum: { amount: true } }),
    todayStats(),
    db.listing.count({ where: LISTED }),
    db.listing.count({ where: { ...LISTED, createdAt: { gte: since } } }),
    db.bid.groupBy({
      by: ["listingId"],
      where: { ...CONFIRMED, listing: LISTED },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    }),
    launchedAt(),
  ]);
  const top = leader
    ? await db.listing.findUnique({ where: { id: leader.listingId }, include: { board: { include: { city: true, category: true } } } })
    : null;
  return {
    visitors,
    online: live.online,
    raised: raised._sum.amount ?? 0,
    raisedToday: today.amount,
    bidsToday: today.bids,
    listed,
    addedToday,
    highest: top && {
      total: leader._sum.amount ?? 0,
      name: top.name,
      board: `${top.board.city.name} · ${top.board.category.name}`,
      href: `/${top.board.city.slug}/${top.board.category.slug}`,
    },
    launched,
    currency: "INR",
  };
}
