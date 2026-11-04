import { avatarUrls } from "./avatars";
import { avatarFor, type Avatar } from "./board-view";
import { db } from "./db";
import { rankListings } from "./ranking";
import { startOfLocalDay } from "./time";

// The Categories page: every category in a city with the top of its All-time board, and the
// most active categories by how many bids were confirmed today on any of their boards.

const TOP_ROWS = 3;
const HOTTEST = 3;

export type CategoryCard = {
  slug: string;
  name: string;
  href: string; // the category's All-time board in this city
  listed: number; // businesses on the board
  top: { id: string; name: string; rank: number; total: number; avatar: Avatar }[];
  claimsToday: number; // confirmed bids today, All-time and Today boards
  lastClaim: Date | null;
};

export async function cityCategories(city: { id: string; slug: string; timeZone: string }, now = new Date()) {
  const boards = await db.board.findMany({
    where: { cityId: city.id, type: "ALL_TIME", active: true, category: { active: true, banned: false } },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
  const inCity = { status: "CONFIRMED" as const, listing: { board: { cityId: city.id } } };
  const [listings, recent, today] = await Promise.all([
    db.listing.findMany({ where: { boardId: { in: boards.map((b) => b.id) }, status: "LIVE" }, select: { id: true, name: true, boardId: true, createdAt: true } }),
    db.bid.groupBy({ by: ["listingId"], where: inCity, _max: { confirmedAt: true } }),
    db.bid.groupBy({ by: ["listingId"], where: { ...inCity, confirmedAt: { gte: startOfLocalDay(now, city.timeZone) } }, _count: { _all: true } }),
  ]);
  // All-time boards have a single period, so a listing's confirmed bids are its total.
  const [totals, bidCategories] = await Promise.all([
    db.bid.groupBy({
      by: ["listingId"],
      where: { listingId: { in: listings.map((l) => l.id) }, status: "CONFIRMED" },
      _sum: { amount: true },
      _max: { confirmedAt: true },
    }),
    db.listing.findMany({ where: { id: { in: recent.map((r) => r.listingId) } }, select: { id: true, board: { select: { categoryId: true } } } }),
  ]);
  const totalOf = new Map(totals.map((t) => [t.listingId, t]));
  const categoryOf = new Map(bidCategories.map((l) => [l.id, l.board.categoryId]));
  const claims = new Map<string, { today: number; last: Date | null }>();
  for (const r of recent) {
    const id = categoryOf.get(r.listingId);
    const at = r._max.confirmedAt;
    if (!id || !at) continue;
    const c = claims.get(id) ?? { today: 0, last: null };
    if (!c.last || at > c.last) c.last = at;
    claims.set(id, c);
  }
  for (const t of today) {
    const c = claims.get(categoryOf.get(t.listingId) ?? "");
    if (c) c.today += t._count._all;
  }

  const ranked = boards.map((b) => ({
    board: b,
    rows: rankListings(
      listings
        .filter((l) => l.boardId === b.id)
        .map((l) => ({ ...l, total: totalOf.get(l.id)?._sum.amount ?? 0, reachedAt: totalOf.get(l.id)?._max.confirmedAt ?? null })),
    ),
  }));
  const shown = ranked.flatMap((r) => r.rows.filter((l) => l.rank !== null).slice(0, TOP_ROWS));
  const pictures = await avatarUrls(shown.map((l) => l.id));

  const cards: CategoryCard[] = ranked.map(({ board, rows }) => ({
    slug: board.category.slug,
    name: board.category.name,
    href: `/${city.slug}/${board.category.slug}`,
    listed: rows.length,
    top: rows
      .filter((l) => l.rank !== null)
      .slice(0, TOP_ROWS)
      .map((l) => ({ id: l.id, name: l.name, rank: l.rank!, total: l.total, avatar: avatarFor(l.name, pictures.get(l.id)) })),
    claimsToday: claims.get(board.categoryId)?.today ?? 0,
    lastClaim: claims.get(board.categoryId)?.last ?? null,
  }));
  const hottest = cards
    .filter((c) => c.lastClaim)
    .sort((a, b) => b.claimsToday - a.claimsToday || b.lastClaim!.getTime() - a.lastClaim!.getTime())
    .slice(0, HOTTEST);
  return { cards, hottest };
}
