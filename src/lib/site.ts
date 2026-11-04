import { cache } from "react";
import { db } from "./db";
import { startOfLocalDay } from "./time";

/** The board the home page shows and the header's "Today" link opens. */
export const DEFAULT_BOARD = { city: "surat", category: "cafes" } as const;

/** Day boundary for site-wide counts. Every launch city is in India. */
export const SITE_TIME_ZONE = "Asia/Kolkata";

/** The city a Daily or Categories page is for: /daily/mumbai, or the default city at /daily. */
export async function cityForPage(path: string[] = []) {
  if (path.length > 1) return null;
  const [city, cities] = await Promise.all([
    db.city.findFirst({ where: { slug: path[0] ?? DEFAULT_BOARD.city, active: true } }),
    db.city.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return city ? { city, cities } : null;
}

/** Confirmed bids since local midnight across every board (the About page). */
export const todayStats = cache(async () => {
  const since = startOfLocalDay(new Date(), SITE_TIME_ZONE);
  const agg = await db.bid.aggregate({
    where: { status: "CONFIRMED", confirmedAt: { gte: since }, currency: "INR" },
    _count: true,
    _sum: { amount: true },
  });
  return { bids: agg._count, amount: agg._sum.amount ?? 0, currency: "INR" };
});
