import { describe, expect, it } from "vitest";
import { bidShortcuts, bidTargets, priceToPass, priceToReach, priceToTop, rankAfterBid, rankListings } from "./ranking";

const d = (s: string) => new Date(s);
const listing = (id: string, total: number, reachedAt?: string, createdAt = "2026-01-01") => ({
  id,
  total,
  reachedAt: reachedAt ? d(reachedAt) : null,
  createdAt: d(createdAt),
});

describe("rankListings", () => {
  it("orders by total, highest first", () => {
    const r = rankListings([listing("b", 32000, "2026-02-01"), listing("a", 50000, "2026-02-01")]);
    expect(r.map((l) => [l.id, l.rank])).toEqual([["a", 1], ["b", 2]]);
  });

  it("breaks ties by who reached the total first (BR-03)", () => {
    const r = rankListings([listing("late", 1000, "2026-02-02"), listing("early", 1000, "2026-02-01")]);
    expect(r.map((l) => l.id)).toEqual(["early", "late"]);
  });

  it("puts listings with no bids below every bid listing, unranked (FR-BRD-06)", () => {
    const r = rankListings([listing("seed", 0), listing("paid", 1000, "2026-02-01")]);
    expect(r.map((l) => [l.id, l.rank])).toEqual([["paid", 1], ["seed", null]]);
  });
});

describe("priceToReach (BR-04)", () => {
  // Worked example from the FSD: Surat → Cafes, step ₹10.
  const board = rankListings([
    listing("A", 50000, "2026-02-01"),
    listing("B", 32000, "2026-02-01"),
    listing("C", 0),
  ]);

  it("charges target total − own total + step", () => {
    expect(priceToReach(board, "C", 1, 1000)).toBe(51000);
    expect(priceToReach(board, "B", 1, 1000)).toBe(19000);
  });

  it("is 0 when the listing already holds the rank", () => {
    expect(priceToReach(board, "A", 1, 1000)).toBe(0);
  });

  it("offers next rank and #1 as shortcuts", () => {
    expect(bidTargets(board, "C", 1000)).toEqual([
      { rank: 2, amount: 33000 },
      { rank: 1, amount: 51000 },
    ]);
  });

  it("treats every unranked listing as one place below the last ranked one", () => {
    const withSeeds = rankListings([...board, listing("D", 0, undefined, "2026-01-02")]);
    expect(bidTargets(withSeeds, "D", 1000)).toEqual(bidTargets(withSeeds, "C", 1000));
  });

  it("offers #1 for one step when nobody has bid yet", () => {
    const empty = rankListings([listing("X", 0), listing("Y", 0, undefined, "2026-01-02")]);
    expect(bidTargets(empty, "X", 1000)).toEqual([{ rank: 1, amount: 1000 }]);
    expect(bidTargets(empty, "Y", 1000)).toEqual([{ rank: 1, amount: 1000 }]);
  });

  it("offers no rank shortcut to #1", () => {
    expect(bidTargets(board, "A", 1000)).toEqual([]);
  });
});

describe("claim headline", () => {
  const totals = [
    { id: "A", total: 501000 },
    { id: "B", total: 500000 },
    { id: "C", total: 159000 },
    { id: "D", total: 0 },
  ];

  it("prices #1 for a business with no bids at the top total plus a step", () => {
    expect(priceToTop(totals, 1000)).toBe(502000);
    expect(priceToTop([], 1000)).toBe(1000);
  });

  it("finds the rank an amount reaches for a new business", () => {
    expect(rankAfterBid(totals, null, 502000)).toBe(1);
    expect(rankAfterBid(totals, null, 482000)).toBe(3);
    expect(rankAfterBid(totals, null, 1000)).toBe(4);
  });

  it("adds the amount to the listing's own total and loses ties (BR-03)", () => {
    expect(rankAfterBid(totals, "C", 342000)).toBe(2);
    expect(rankAfterBid(totals, "C", 341000)).toBe(3);
    expect(rankAfterBid(totals, "A", 1000)).toBe(1);
  });
});

describe("priceToPass (claim this rank)", () => {
  const rows = [
    { id: "A", total: 501000, rank: 1 },
    { id: "B", total: 500000, rank: 2 },
    { id: "C", total: 159000, rank: 3 },
    { id: "D", total: 20000, rank: 4 },
    { id: "E", total: 0, rank: null },
  ];

  it("prices a rank for a business with no bids at that total plus a step", () => {
    expect(priceToPass(rows, null, "D", 10000, 10000)).toBe(30000);
    expect(rankAfterBid(rows, null, 30000)).toBe(4);
    expect(priceToPass(rows, null, "C", 10000, 10000)).toBe(169000);
    expect(rankAfterBid(rows, null, 169000)).toBe(3);
    expect(priceToPass(rows, null, "A", 10000, 10000)).toBe(priceToTop(rows, 10000, 10000));
  });

  it("counts what the claimer already has, and never goes below the minimum bid", () => {
    expect(priceToPass(rows, "C", "A", 10000, 10000)).toBe(352000);
    expect(priceToPass(rows, "B", "A", 1000, 10000)).toBe(10000);
    expect(priceToPass(rows, "E", "D", 10000, 10000)).toBe(30000);
  });

  it("has nothing to claim on an unranked listing, the claimer's own, or one below it", () => {
    expect(priceToPass(rows, null, "E", 10000, 10000)).toBeNull();
    expect(priceToPass(rows, "C", "C", 10000, 10000)).toBeNull();
    expect(priceToPass(rows, "C", "D", 10000, 10000)).toBeNull();
    expect(priceToPass(rows, null, "missing", 10000, 10000)).toBeNull();
  });
});

describe("minimum bid (₹100)", () => {
  const totals = [
    { id: "A", total: 501000 },
    { id: "B", total: 500000 },
    { id: "C", total: 159000 },
    { id: "D", total: 2000 },
    { id: "E", total: 0 },
  ];

  it("never prices taking #1 below the minimum", () => {
    expect(priceToTop([], 1000, 10000)).toBe(10000);
    expect(priceToTop(totals, 1000, 10000)).toBe(502000);
  });

  it("raises small shortcuts to the minimum and labels the rank it really reaches", () => {
    // B needs ₹20 to pass A, so the ₹100 minimum is the only shortcut, and it takes #1.
    expect(bidShortcuts(totals, "B", 1000, 10000)).toEqual([{ rank: 1, amount: 10000 }]);
    // E (no bids) passes D with the minimum alone, landing at #4.
    expect(bidShortcuts(totals, "E", 1000, 10000)).toEqual([
      { rank: 4, amount: 10000 },
      { rank: 1, amount: 502000 },
    ]);
  });

  it("gives the current #1 no shortcut, and a new business on an empty board the minimum", () => {
    expect(bidShortcuts(totals, "A", 1000, 10000)).toEqual([]);
    expect(bidShortcuts([], null, 1000, 10000)).toEqual([{ rank: 1, amount: 10000 }]);
    expect(bidShortcuts(totals, null, 1000, 10000)[0]).toEqual({ rank: 4, amount: 10000 });
  });
});
