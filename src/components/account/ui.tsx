import type { BoardType } from "@prisma/client";

// Small server-rendered pieces shared by the account, verify and receipt pages.

type BoardNames = { type: BoardType; city: { name: string; slug: string }; category: { name: string; slug: string } };

const PERIOD_SUFFIX: Record<BoardType, string> = { ALL_TIME: "", DAILY: " (Today)", WEEKLY: " (This week)" };
const PERIOD_QUERY: Record<BoardType, string> = { ALL_TIME: "", DAILY: "?period=today", WEEKLY: "?period=week" };

/** "Mumbai → Restaurants", with the period for daily and weekly boards. */
export const boardName = (b: BoardNames) => `${b.city.name} → ${b.category.name}${PERIOD_SUFFIX[b.type]}`;

export const boardHref = (b: BoardNames) => `/${b.city.slug}/${b.category.slug}${PERIOD_QUERY[b.type]}`;

export function VerifiedBadge() {
  return (
    <span className="badge-verified">
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <rect width="10" height="10" rx="2.5" fill="currentColor" />
        <path d="M2.7 5.2 4.3 6.8 7.3 3.6" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  );
}

const DAY = (timeZone: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
const DAY_TIME = (timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone });

/** "2 Nov 2026" in the board's city time zone. */
export const formatDay = (at: Date, timeZone: string) => DAY(timeZone).format(at);

/** "2 Nov 2026, 12:21 am" in the board's city time zone. */
export const formatDayTime = (at: Date, timeZone: string) => DAY_TIME(timeZone).format(at);
