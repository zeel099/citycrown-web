import { Prisma, type BoardType } from "@prisma/client";
import { db } from "./db";
import { rankListings } from "./ranking";
import { periodBounds } from "./time";

export const PERIOD_PARAM: Record<string, BoardType> = { "all-time": "ALL_TIME", today: "DAILY", week: "WEEKLY" };

/**
 * Current period for a board, opened lazily: the first request after a reset
 * closes the old period and opens the new one (FR-PER-02). Closed periods keep
 * their bids, which is the archive (FR-PER-03).
 */
export async function currentPeriod(board: { id: string; type: BoardType }, timeZone: string, now = new Date()) {
  const { startsAt, endsAt } = periodBounds(board.type, now, timeZone);
  const key = { boardId_startsAt: { boardId: board.id, startsAt } };
  let period;
  try {
    period = await db.period.upsert({ where: key, create: { boardId: board.id, startsAt, endsAt }, update: {} });
  } catch (err) {
    // Right after a reset, several requests (the board, its sidebar, the page title) open the
    // new period at once. Prisma's upsert isn't atomic, so the losers get a unique-constraint
    // error: the period they tried to create now exists, so use it.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    period = await db.period.findUniqueOrThrow({ where: key });
  }
  await db.period.updateMany({
    where: { boardId: board.id, status: "OPEN", startsAt: { lt: startsAt } },
    data: { status: "CLOSED" },
  });
  return period;
}

export async function findBoard(citySlug: string, categorySlug: string, type: BoardType) {
  return db.board.findFirst({
    where: {
      type,
      active: true,
      city: { slug: citySlug, active: true },
      category: { slug: categorySlug, active: true, banned: false },
    },
    include: { city: true, category: true },
  });
}

/** Live listings on a board with their period totals, ranked. */
export async function loadRankedBoard(board: { id: string; type: BoardType; city: { timeZone: string } }) {
  const period = await currentPeriod(board, board.city.timeZone);
  const [listings, totals] = await Promise.all([
    db.listing.findMany({ where: { boardId: board.id, status: "LIVE" } }),
    db.bid.groupBy({
      by: ["listingId"],
      where: { periodId: period.id, status: "CONFIRMED" },
      _sum: { amount: true },
      _max: { confirmedAt: true },
    }),
  ]);
  const byListing = new Map(totals.map((t) => [t.listingId, t]));
  const ranked = rankListings(
    listings.map((l) => ({
      ...l,
      total: byListing.get(l.id)?._sum.amount ?? 0,
      reachedAt: byListing.get(l.id)?._max.confirmedAt ?? null,
    })),
  );
  return { period, ranked };
}

/**
 * FR-PER-03: final top three of each closed period that had bids, newest first.
 * A period counts as closed once its end has passed, even before the next
 * request formally closes it.
 */
export async function closedPeriodResults(board: { id: string }, limit = 30, now = new Date()) {
  const periods = await db.period.findMany({
    where: {
      boardId: board.id,
      OR: [{ status: "CLOSED" }, { endsAt: { lte: now } }],
      bids: { some: { status: "CONFIRMED" } },
    },
    orderBy: { startsAt: "desc" },
    take: limit,
  });
  if (!periods.length) return [];
  const sums = await db.bid.groupBy({
    by: ["periodId", "listingId"],
    where: { periodId: { in: periods.map((p) => p.id) }, status: "CONFIRMED" },
    _sum: { amount: true },
    _max: { confirmedAt: true },
    _count: { _all: true },
  });
  const listings = await db.listing.findMany({
    where: { id: { in: [...new Set(sums.map((s) => s.listingId))] }, status: { notIn: ["REMOVED", "REJECTED"] } },
    select: { id: true, name: true, createdAt: true },
  });
  const byId = new Map(listings.map((l) => [l.id, l]));

  const results = periods.map((p) => {
    const rows = sums.filter((s) => s.periodId === p.id && byId.has(s.listingId));
    const ranked = rankListings(
      rows.map((s) => ({
        ...byId.get(s.listingId)!,
        total: s._sum.amount ?? 0,
        reachedAt: s._max.confirmedAt,
      })),
    );
    return {
      id: p.id,
      startsAt: p.startsAt,
      bids: rows.reduce((n, s) => n + s._count._all, 0),
      top: ranked.filter((l) => l.rank !== null).slice(0, 3).map((l) => ({ name: l.name, total: l.total })),
    };
  });
  return results.filter((p) => p.top.length > 0);
}
