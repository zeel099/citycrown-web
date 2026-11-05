import type { BoardType, Listing } from "@prisma/client";
import type { LatLng, Place } from "./geo";
import { bidTargets, type Ranked } from "./ranking";
import { db } from "./db";

/** image: the business's saved picture (see lib/avatars), shown instead of the letter tile. */
export type Avatar = { letter: string; color: string; image: string | null };

/** Serializable row for the client board (no Dates, no internal fields). */
export type BoardRow = {
  id: string;
  name: string;
  rank: number | null;
  total: number;
  links: { website: boolean; instagram: boolean; facebook: boolean };
  targets: { rank: number; amount: number }[];
  verified: boolean; // an owner verification succeeded
  clicks: number; // outbound clicks, all time (FR-ANL-01)
  lastBid: string | null; // "2 hours ago", in this period
  rating: { stars: number; reviews: number } | null; // FR-BRD-09
  followers: number | null; // Instagram followers, saved when the business was paid for
  location: Place | null; // where the business is, from its owner
  avatar: Avatar;
};

/** Top of the board's other period, for the sidebar ("Today's ranking"). */
export type MiniBoard = {
  label: string;
  href: string;
  rows: { id: string; name: string; rank: number; total: number; avatar: Avatar }[];
};

export type BoardProps = {
  boardId: string;
  title: { city: string; category: string };
  slugs: { city: string; category: string };
  categories: { slug: string; name: string }[]; // the city's categories with a board for this period (claim bar menu)
  cityCenter: LatLng | null; // biases owners' address search to this city
  basePath: string;
  currency: string;
  step: number;
  minBid: number;
  topN: number;
  period: { type: BoardType; endsAt: string | null; resets: string | null; href: string };
  periods: { type: BoardType; href: string; label: string }[];
  rows: BoardRow[];
  other: MiniBoard | null;
};

type RankedListing = Ranked<Listing & { total: number; reachedAt: Date | null }>;

export function toRows(
  ranked: RankedListing[],
  step: number,
  clicks: Map<string, number>,
  pictures: Map<string, string> = new Map(),
  now = new Date(),
): BoardRow[] {
  return ranked.map((l) => ({
    id: l.id,
    name: l.name,
    rank: l.rank,
    total: l.total,
    links: { website: !!l.websiteUrl, instagram: !!l.instagramUrl, facebook: !!l.facebookUrl },
    targets: bidTargets(ranked, l.id, step),
    verified: l.verifiedAt !== null,
    clicks: clicks.get(l.id) ?? 0,
    lastBid: l.total > 0 && l.reachedAt ? timeAgo(l.reachedAt, now) : null,
    rating: l.googleRating !== null ? { stars: l.googleRating, reviews: l.googleReviews ?? 0 } : null,
    followers: l.instagramFollowers,
    location: l.latitude != null && l.longitude != null ? { lat: l.latitude, lng: l.longitude, address: l.address ?? "" } : null,
    avatar: avatarFor(l.name, pictures.get(l.id)),
  }));
}

// Tile colours for the letter avatar; each passes 3:1 against white text.
const AVATAR_COLORS = ["#E5603F", "#C2386E", "#1D8150", "#C26A12", "#4A5263", "#0F7F78", "#3461C7", "#7A4FBF"];

/** First letter (skipping a leading "The") on a colour that stays the same on every board. */
export function avatarFor(name: string, image: string | null = null): Avatar {
  const letter = (name.replace(/^the\s+/i, "").match(/[\p{L}\p{N}]/u)?.[0] ?? "#").toUpperCase();
  // FNV-1a over the name, so the same business gets the same colour on its All-time and Today listings.
  let hash = 2166136261;
  for (const ch of name.trim().toLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  hash ^= hash >>> 15;
  return { letter, color: AVATAR_COLORS[(hash >>> 0) % AVATAR_COLORS.length], image };
}

const UNITS: [number, string][] = [
  [365 * 864e5, "year"],
  [30 * 864e5, "month"],
  [864e5, "day"],
  [36e5, "hour"],
  [6e4, "min"],
];

/** "2 hours ago", "1 min ago", "just now". */
export function timeAgo(at: Date, now = new Date()): string {
  const ms = now.getTime() - at.getTime();
  for (const [size, unit] of UNITS) {
    const n = Math.floor(ms / size);
    if (n >= 1) return `${n} ${unit}${n === 1 || unit === "min" ? "" : "s"} ago`;
  }
  return "just now";
}

/** Short zone name for reset notes, e.g. "IST" for Asia/Kolkata. */
export function zoneLabel(timeZone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone, timeZoneName: "short" }).formatToParts(at);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

/** FR-PER-01: when a period board resets, e.g. "Resets every day at midnight IST". */
export function resetNote(type: BoardType, timeZone: string): string | null {
  if (type === "ALL_TIME") return null;
  const when = type === "DAILY" ? "every day" : "every Monday";
  return `Resets ${when} at midnight ${zoneLabel(timeZone)}`;
}

export const PERIOD_LABEL: Record<BoardType, string> = { ALL_TIME: "All-time", DAILY: "Today", WEEKLY: "This week" };
const PARAM: Record<BoardType, string> = { ALL_TIME: "all-time", DAILY: "today", WEEKLY: "week" };

export const periodHref = (basePath: string, type: BoardType) =>
  type === "ALL_TIME" ? basePath : `${basePath}?period=${PARAM[type]}`;

export async function periodTabs(cityId: string, categoryId: string, basePath: string) {
  const boards = await db.board.findMany({ where: { cityId, categoryId, active: true }, select: { type: true } });
  const order: BoardType[] = ["ALL_TIME", "DAILY", "WEEKLY"];
  return order
    .filter((t) => boards.some((b) => b.type === t))
    .map((type) => ({ type, label: PERIOD_LABEL[type], href: periodHref(basePath, type) }));
}
