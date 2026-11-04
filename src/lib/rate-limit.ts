// Per-visitor caps on calls that reach other services (Instagram, Facebook, websites,
// address search). Kept on globalThis so every route shares them; per server process.

const WINDOW_MS = 60_000;

const store = globalThis as unknown as { __bitcLimits?: Map<string, number[]> };
const recent = (store.__bitcLimits ??= new Map<string, number[]>());

/** True if this visitor has made fewer than `max` calls of this kind in the last minute (and counts this one). */
export function allow(kind: string, visitor: string, max: number): boolean {
  const key = `${kind}:${visitor}`;
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= max) return false;
  times.push(now);
  if (recent.size > 10_000) recent.clear();
  recent.set(key, times);
  return true;
}

/** Online checks of business links: each fetches Instagram, Facebook or a website. */
export const allowOnlineCheck = (visitor: string) => allow("online", visitor, 20);

/** Address search while typing (debounced), current-location lookups and Maps links. */
export const allowGeocode = (visitor: string) => allow("geo", visitor, 40);
