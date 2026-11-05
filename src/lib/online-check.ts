import { displayLink, platformOf, type Platform } from "./business-link";
import { fetchPublicImage, fetchPublicPage, type FetchResult } from "./verification";

// Claim bar: does a pasted Instagram account, Facebook page or website actually exist?
// Instagram and Facebook answer 200 for missing profiles too, so we read the page:
// a real profile carries its name in og:title, a missing one only the bare site name.

export type OnlineCheck =
  // image: profile picture or site icon URL (server only); followers: Instagram only
  | { status: "found"; platform: Platform; name: string | null; image: string | null; followers: number | null }
  | { status: "missing"; platform: Platform; message: string }
  | { status: "unknown"; platform: Platform; message: string }; // blocked or unreachable: staff check it

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function meta(html: string, property: string): string | null {
  const head = html.slice(0, 200_000);
  const tag = head.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i"))?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content).trim() : null;
}

function title(html: string): string | null {
  const t = html.slice(0, 200_000).match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return t ? decodeEntities(t).trim() : null;
}

/** "175K Followers, 43 Following, 1,395 Posts - See Instagram photos…" → 175000. */
export function parseFollowers(description: string | null): number | null {
  const m = description?.match(/([\d.,]+)\s*([KkMm]?)\s+Followers/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, "")) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] ?? 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** An absolute https URL, or null. */
function httpsUrl(value: string | null | undefined, base?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The site's own icon: apple-touch-icon first (a clean 180px square), then the largest declared icon. */
export function siteIcon(html: string, pageUrl: string): string | null {
  const links = html.slice(0, 200_000).match(/<link\b[^>]*>/gi) ?? [];
  let best: { href: string; score: number } | null = null;
  for (const tag of links) {
    const rel = tag.match(/rel=["']([^"']*)["']/i)?.[1]?.toLowerCase() ?? "";
    const href = tag.match(/href=["']([^"']*)["']/i)?.[1];
    if (!href || !/(^|\s)(apple-touch-icon|icon)(\s|$)/.test(rel) || /\.svg(\?|$)/i.test(href)) continue;
    const size = Number(tag.match(/sizes=["'](\d+)x\d+/i)?.[1] ?? 0);
    const score = (rel.includes("apple-touch-icon") ? 1000 : 0) + Math.min(size, 512);
    if (!best || score > best.score) best = { href: decodeEntities(href), score };
  }
  return httpsUrl(best?.href, pageUrl);
}

const clip = (s: string) => (s.length > 80 ? `${s.slice(0, 77).trimEnd()}…` : s);

/** "Blue Tokai Coffee Roasters (@bluetokaicoffee) • Instagram photos and videos" → found, with the name. */
export function readInstagram(handle: string, page: FetchResult): OnlineCheck {
  const platform = "Instagram";
  const unknown = { status: "unknown", platform, message: "We couldn't reach Instagram to confirm this account. You can continue, and our team will check it." } as const;
  if (!page.ok || page.status >= 500 || page.status === 429) return unknown;
  if (page.status === 404) return { status: "missing", platform, message: `We couldn't find @${handle} on Instagram. Check the spelling.` };
  if (/\/accounts\/login|\/challenge/.test(new URL(page.url).pathname)) return unknown;
  const og = meta(page.body, "og:title");
  const match = og?.match(/^(.*?)\s*\(@([^)]+)\)/);
  if (match && match[2].toLowerCase() === handle.toLowerCase()) {
    const name = match[1].trim();
    return {
      status: "found",
      platform,
      name: name && name.toLowerCase() !== handle.toLowerCase() ? clip(name) : null,
      image: httpsUrl(meta(page.body, "og:image")),
      followers: parseFollowers(meta(page.body, "og:description") ?? meta(page.body, "description")),
    };
  }
  // A missing account gets a page titled just "Instagram" with no profile details; a login wall says "Login".
  const t = title(page.body);
  if (!og && t === "Instagram") return { status: "missing", platform, message: `We couldn't find @${handle} on Instagram. Check the spelling.` };
  return unknown;
}

/** A real page redirects to its canonical address and names itself in og:title; a missing one is a bare "Facebook" page. */
export function readFacebook(page: FetchResult, shown: string): OnlineCheck {
  const platform = "Facebook";
  const unknown = { status: "unknown", platform, message: "We couldn't reach Facebook to confirm this page. You can continue, and our team will check it." } as const;
  if (!page.ok || page.status >= 500 || page.status === 429) return unknown;
  if (page.status === 404) return { status: "missing", platform, message: `We couldn't find ${shown} on Facebook. Check the link.` };
  if (/\/login|\/checkpoint/.test(new URL(page.url).pathname)) return unknown;
  const og = meta(page.body, "og:title");
  // Facebook writes its follower count in the visitor's language, so it isn't read.
  if (og && !/^(facebook|log in|log into facebook)/i.test(og)) return { status: "found", platform, name: clip(og), image: httpsUrl(meta(page.body, "og:image")), followers: null };
  if (!og && title(page.body) === "Facebook") return { status: "missing", platform, message: `We couldn't find ${shown} on Facebook. Check the link.` };
  return unknown;
}

/** A website is online if its address exists and answers; 404 means the page isn't there. */
export function readWebsite(page: FetchResult, shown: string): OnlineCheck {
  const platform = "Website";
  if (!page.ok) {
    if (page.notFound) return { status: "missing", platform, message: `${shown} doesn't exist. Check the address.` };
    if (/public|insecure|can't check/.test(page.reason)) return { status: "missing", platform, message: `${shown} can't be used: ${page.reason}.` };
    return { status: "unknown", platform, message: `We couldn't reach ${shown} right now (${page.reason}). You can continue, and our team will check it.` };
  }
  if (page.status === 404 || page.status === 410) return { status: "missing", platform, message: `${shown} doesn't have that page. Check the address.` };
  if (page.status >= 500) return { status: "unknown", platform, message: `${shown} isn't answering properly right now. You can continue, and our team will check it.` };
  // 2xx, or a 401/403/429 from a site that blocks robots: it exists.
  const name = page.status < 300 ? (meta(page.body, "og:site_name") ?? meta(page.body, "og:title") ?? title(page.body)) : null;
  const short = name?.split(/\s+[|–—-]\s+/)[0]?.trim();
  return { status: "found", platform, name: short ? clip(short) : null, image: page.status < 300 ? siteIcon(page.body, page.url) : null, followers: null };
}

type Image = { bytes: Buffer; type: string };

// On globalThis so every route (the lookup and the avatar) shares the same results.
const store = globalThis as unknown as {
  __bitcOnline?: Map<string, { result: OnlineCheck; at: number }>;
  __bitcAvatars?: Map<string, { image: Image | null; at: number }>;
};
const cache = (store.__bitcOnline ??= new Map<string, { result: OnlineCheck; at: number }>());
const avatars = (store.__bitcAvatars ??= new Map<string, { image: Image | null; at: number }>());
const TTL = { found: 10 * 60e3, missing: 2 * 60e3, unknown: 30e3 };

/** A cached check that's still fresh, without fetching anything. */
function cachedCheck(link: string): OnlineCheck | null {
  const hit = cache.get(link);
  return hit && Date.now() - hit.at < TTL[hit.result.status] ? hit.result : null;
}

/** Checks a canonical business link (see parseBusinessLink) online. Results are cached briefly. */
export async function checkOnline(link: string): Promise<OnlineCheck> {
  const hit = cachedCheck(link);
  if (hit) return hit;

  const platform = platformOf(link);
  const shown = displayLink(link);
  const url = new URL(link);
  let result: OnlineCheck;
  if (platform === "Instagram") {
    const handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
    result = handle
      ? readInstagram(handle, await fetchPublicPage(`https://www.instagram.com/${handle}/`))
      : { status: "missing", platform, message: "Add your Instagram handle, like @yourshop." };
  } else if (platform === "Facebook") {
    result = url.pathname.length > 1 ? readFacebook(await fetchPublicPage(`https://www.facebook.com${url.pathname}`), shown) : { status: "missing", platform, message: "Add your Facebook page's address, like facebook.com/yourshop." };
  } else {
    result = readWebsite(await fetchPublicPage(link), shown);
  }

  if (cache.size > 2000) cache.clear();
  cache.set(link, { result, at: Date.now() });
  return result;
}

/** Google's copy of a site's icon, for sites that block robots or declare none. 404s when it has none. */
const googleIcon = (host: string) =>
  `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(host)}&size=128`;

// SVG can carry scripts, so only raster images are served.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/x-icon", "image/vnd.microsoft.icon"]);
const AVATAR_TTL = { found: 24 * 3600e3, none: 5 * 60e3 }; // a failed fetch is retried soon

/**
 * The profile picture or site icon for a link. Uses the recent check when there is one
 * (the claim bar has just looked the link up); otherwise checks it again only if
 * `mayCheck` allows, which the caller ties to the per-visitor limit.
 */
export async function avatarFor(link: string, mayCheck: () => boolean): Promise<Image | null> {
  const hit = avatars.get(link);
  if (hit && Date.now() - hit.at < AVATAR_TTL[hit.image ? "found" : "none"]) return hit.image;
  const checked = cachedCheck(link) ?? (mayCheck() ? await checkOnline(link) : null);
  if (checked?.status !== "found") return null;

  const sources = [checked.image, checked.platform === "Website" ? googleIcon(new URL(link).hostname) : null].filter((s): s is string => !!s);
  let image: { bytes: Buffer; type: string } | null = null;
  for (const src of sources) {
    const got = await fetchPublicImage(src);
    if (got && IMAGE_TYPES.has(got.type)) {
      image = got;
      break;
    }
  }
  if (avatars.size > 500) avatars.clear();
  avatars.set(link, { image, at: Date.now() });
  return image;
}
