import { avatarUrls } from "./avatars";
import { avatarFor, type Avatar } from "./board-view";
import { db } from "./db";
import { rankListings } from "./ranking";

// Header search: businesses by name or link across every city, plus matching cities and categories.

const MAX_RESULTS = 30;

export type SearchHit = {
  id: string;
  name: string;
  city: { slug: string; name: string };
  category: { slug: string; name: string };
  rank: number | null; // on its All-time board
  total: number;
  currency: string;
  avatar: Avatar;
};

const OPEN_BOARD = { type: "ALL_TIME" as const, active: true, city: { active: true }, category: { active: true, banned: false } };

/** cityFirst: the city the visitor came from, whose businesses are listed first. */
export async function search(query: string, cityFirst?: string) {
  const q = query.trim().replace(/^@/, "").slice(0, 80);
  if (q.length < 2) return { businesses: [] as SearchHit[], cities: [], categories: [] };
  const like = (text: string) => ({ contains: text, mode: "insensitive" as const });
  // Links match from the start of a handle or domain ("@brewlane", "brewlane.in"), so "com" doesn't match every site.
  const byLink = [
    { instagramUrl: like(`instagram.com/${q}`) },
    { facebookUrl: like(`facebook.com/${q}`) },
    { websiteUrl: like(`//${q}`) },
    { websiteUrl: like(`//www.${q}`) },
  ];

  const [listings, cities, categories] = await Promise.all([
    db.listing.findMany({
      where: { status: "LIVE", board: OPEN_BOARD, OR: [{ name: like(q) }, ...byLink] },
      include: { board: { include: { city: true, category: true } } },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.city.findMany({ where: { active: true, name: like(q) }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.category.findMany({ where: { active: true, banned: false, name: like(q) }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  const found = listings
    .sort((a, b) => Number(b.board.city.slug === cityFirst) - Number(a.board.city.slug === cityFirst))
    .slice(0, MAX_RESULTS);

  // Rank each result on its own board.
  const boardIds = [...new Set(found.map((l) => l.boardId))];
  const onBoards = await db.listing.findMany({ where: { boardId: { in: boardIds }, status: "LIVE" }, select: { id: true, boardId: true, createdAt: true } });
  const [totals, pictures] = await Promise.all([
    db.bid.groupBy({ by: ["listingId"], where: { listingId: { in: onBoards.map((l) => l.id) }, status: "CONFIRMED" }, _sum: { amount: true }, _max: { confirmedAt: true } }),
    avatarUrls(found.map((l) => l.id)),
  ]);
  const totalOf = new Map(totals.map((t) => [t.listingId, t]));
  const rankOf = new Map(
    boardIds.flatMap((id) =>
      rankListings(
        onBoards
          .filter((l) => l.boardId === id)
          .map((l) => ({ ...l, total: totalOf.get(l.id)?._sum.amount ?? 0, reachedAt: totalOf.get(l.id)?._max.confirmedAt ?? null })),
      ).map((l) => [l.id, l] as const),
    ),
  );

  const businesses: SearchHit[] = found.map((l) => ({
    id: l.id,
    name: l.name,
    city: { slug: l.board.city.slug, name: l.board.city.name },
    category: { slug: l.board.category.slug, name: l.board.category.name },
    rank: rankOf.get(l.id)?.rank ?? null,
    total: rankOf.get(l.id)?.total ?? 0,
    currency: l.board.city.currency,
    avatar: avatarFor(l.name, pictures.get(l.id)),
  }));
  return { businesses, cities, categories };
}
