import { Prisma } from "@prisma/client";
import { db } from "./db";
import { isBot, sessionHash } from "./events";
import { SITE_TIME_ZONE } from "./site";

// The header's "20 online · 2,849 visitors today". Every open page checks in every 30 seconds
// (components/LiveStats); a visitor counts as online until ONLINE_MS after their last check-in.

const ONLINE_MS = 75_000;

/** Today's date in the site time zone, e.g. "2026-11-04" (en-CA formats as yyyy-mm-dd). */
export const visitDay = (at = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE }).format(at);

export type LiveCounts = { online: number; today: number };

export async function liveCounts(now = new Date()): Promise<LiveCounts> {
  const [online, today] = await Promise.all([
    db.visit.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - ONLINE_MS) } } }),
    db.visit.count({ where: { day: visitDay(now) } }),
  ]);
  return { online, today };
}

/** Counts this visitor for today and marks them online. Crawlers aren't counted. */
export async function recordVisit(req: Request, now = new Date()) {
  if (isBot(req)) return;
  const day = visitDay(now);
  const key = { day_visitor: { day, visitor: sessionHash(req, day) } };
  try {
    await db.visit.upsert({ where: key, create: key.day_visitor, update: { lastSeenAt: now } });
  } catch (err) {
    // Two tabs checking in at once: the loser's insert hits the row the other just made.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    await db.visit.update({ where: key, data: { lastSeenAt: now } });
  }
}
