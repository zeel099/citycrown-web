// Ranking rules from FSD section 5. Pure functions, no database access.

export type RankInput = {
  id: string;
  total: number; // confirmed bids in the period, minor units (BR-02)
  reachedAt: Date | null; // when the listing reached its current total
  createdAt: Date;
};

export type Ranked<T extends RankInput> = T & { rank: number | null };

/**
 * BR-01: highest total first.
 * BR-03: equal totals go to the listing that reached the total first.
 * FR-BRD-06: listings with no bids sit below every bid listing, unranked, oldest first.
 */
export function rankListings<T extends RankInput>(listings: T[]): Ranked<T>[] {
  const sorted = [...listings].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.total === 0) return a.createdAt.getTime() - b.createdAt.getTime();
    return (a.reachedAt?.getTime() ?? 0) - (b.reachedAt?.getTime() ?? 0);
  });
  return sorted.map((l, i) => ({ ...l, rank: l.total > 0 ? i + 1 : null }));
}

/**
 * BR-04: amount listing needs to pass the listing currently at targetRank:
 * target total − own total + step. Returns 0 if it already holds that rank or better.
 */
export function priceToReach<T extends RankInput>(
  ranked: Ranked<T>[],
  listingId: string,
  targetRank: number,
  step: number,
): number {
  const index = ranked.findIndex((l) => l.id === listingId);
  if (index === -1) throw new Error(`Listing ${listingId} is not on this board`);
  if (targetRank < 1) throw new Error("targetRank starts at 1");
  if (index + 1 <= targetRank) return 0;
  const target = ranked[targetRank - 1];
  return target.total - ranked[index].total + step;
}

/**
 * The shortcuts shown before payment (FR-BID-03): next rank up and #1.
 * An unranked listing counts as one place below the last ranked listing, and on
 * a board with no bids at all any bid of one step takes #1.
 */
export function bidTargets<T extends RankInput>(ranked: Ranked<T>[], listingId: string, step: number) {
  const listing = ranked.find((l) => l.id === listingId);
  if (!listing) throw new Error(`Listing ${listingId} is not on this board`);
  const rankedCount = ranked.filter((l) => l.rank !== null).length;
  if (rankedCount === 0) return [{ rank: 1, amount: step }];
  const position = listing.rank ?? rankedCount + 1;
  const targets: { rank: number; amount: number }[] = [];
  if (position > 1) targets.push({ rank: position - 1, amount: priceToReach(ranked, listingId, position - 1, step) });
  if (position > 2) targets.push({ rank: 1, amount: priceToReach(ranked, listingId, 1, step) });
  return targets;
}

type Total = { id: string; total: number };

/**
 * Rank a listing would hold after adding amount (the claim headline).
 * listingId null stands for a business with no bids yet. Ties stay with the
 * listing that got there first (BR-03), so an equal total ranks below it.
 */
export function rankAfterBid(totals: Total[], listingId: string | null, amount: number): number {
  const own = totals.find((l) => l.id === listingId)?.total ?? 0;
  const next = own + amount;
  return 1 + totals.filter((l) => l.id !== listingId && l.total > 0 && l.total >= next).length;
}

/**
 * What it costs to take the rank of the listing targetId holds (the "claim this rank" pill): its total
 * − the claimer's own + one step, at least the minimum bid. listingId null is a business with no bids.
 * null when the target has no rank to take, or the claimer already ranks above it.
 */
export function priceToPass(
  rows: (Total & { rank: number | null })[],
  listingId: string | null,
  targetId: string,
  step: number,
  minBid: number,
): number | null {
  const target = rows.find((l) => l.id === targetId);
  if (!target?.rank || target.id === listingId) return null;
  const own = rows.find((l) => l.id === listingId);
  if (own?.rank && own.rank < target.rank) return null;
  return Math.max(minBid, target.total - (own?.total ?? 0) + step);
}

/** What a business with no bids pays to take #1: the top total plus one step, and at least the minimum bid. */
export function priceToTop(totals: Total[], step: number, minBid = 0): number {
  return Math.max(minBid, Math.max(0, ...totals.map((l) => l.total)) + step);
}

/**
 * Bid shortcuts shown before payment (FR-BID-03): the next rank up and #1, raised
 * to the minimum bid and labelled with the rank each amount actually reaches (a
 * minimum bid can jump several places). listingId null is a business with no bids.
 * Empty for the current #1, which can only widen its lead.
 */
export function bidShortcuts(totals: Total[], listingId: string | null, step: number, minBid: number): { rank: number; amount: number }[] {
  const own = totals.find((l) => l.id === listingId)?.total ?? 0;
  const above = totals.filter((l) => l.id !== listingId && l.total > 0 && l.total >= own).map((l) => l.total);
  if (!above.length && own > 0) return [];
  const raw = above.length ? [Math.min(...above), Math.max(...above)].map((t) => t - own + step) : [minBid];
  const byRank = new Map<number, number>();
  for (const amount of raw.map((a) => Math.max(minBid, a))) {
    const rank = rankAfterBid(totals, listingId, amount);
    byRank.set(rank, Math.min(amount, byRank.get(rank) ?? Infinity));
  }
  return [...byRank].map(([rank, amount]) => ({ rank, amount })).sort((a, b) => a.amount - b.amount);
}
