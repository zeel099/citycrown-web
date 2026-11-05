// Period boundaries in a city's local time zone (BR-11), without a date library.

/** Offset of timeZone from UTC at the given instant, in milliseconds. */
export function tzOffset(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Local calendar date (y, m, d) of an instant in timeZone. */
function localDate(at: Date, timeZone: string) {
  const local = new Date(at.getTime() + tzOffset(at, timeZone));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate(), dow: local.getUTCDay() };
}

/** UTC instant of local midnight on the given local date. */
function localMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m, d);
  const first = guess - tzOffset(new Date(guess), timeZone);
  // Re-check once in case the guess crossed a DST change.
  return new Date(guess - tzOffset(new Date(first), timeZone));
}

export function startOfLocalDay(at: Date, timeZone: string): Date {
  const { y, m, d } = localDate(at, timeZone);
  return localMidnight(y, m, d, timeZone);
}

/** Weekly boards reset at Monday 00:00 local time. */
export function startOfLocalWeek(at: Date, timeZone: string): Date {
  const { y, m, d, dow } = localDate(at, timeZone);
  const back = (dow + 6) % 7;
  const monday = new Date(Date.UTC(y, m, d - back));
  return localMidnight(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), timeZone);
}

export type PeriodType = "ALL_TIME" | "DAILY" | "WEEKLY";

export const ALL_TIME_START = new Date(0);

export function periodBounds(type: PeriodType, at: Date, timeZone: string): { startsAt: Date; endsAt: Date | null } {
  if (type === "ALL_TIME") return { startsAt: ALL_TIME_START, endsAt: null };
  const startsAt = type === "DAILY" ? startOfLocalDay(at, timeZone) : startOfLocalWeek(at, timeZone);
  const { y, m, d } = localDate(startsAt, timeZone);
  const endsAt = localMidnight(y, m, d + (type === "DAILY" ? 1 : 7), timeZone);
  return { startsAt, endsAt };
}
