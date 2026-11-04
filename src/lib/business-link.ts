// Business links as pasted into the claim bar. Pure: safe to use in the browser.

const SOCIAL_HOSTS = new Set(["instagram.com", "facebook.com", "fb.com"]);

/**
 * One form of a link for comparing businesses: https, no www/m., no query or hash,
 * no trailing slash, and only the profile name for Instagram and Facebook.
 */
export function canonicalLink(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
    if (!host.includes(".")) return null;
    const segments = u.pathname.split("/").filter(Boolean);
    const path = SOCIAL_HOSTS.has(host) ? segments.slice(0, 1) : segments;
    return `https://${host}${path.length ? `/${path.join("/")}` : ""}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * What a business owner pastes into the claim bar: "@monsoonbeans" or "monsoonbeans"
 * (an Instagram handle), or an Instagram, Facebook or website link.
 */
export function parseBusinessLink(input: string): string | null {
  const value = input.trim();
  const handle = value.replace(/^@/, "");
  if (value.startsWith("@") || /^[a-z0-9_]{1,30}$/i.test(handle)) {
    return /^[a-z0-9_.]{1,30}$/i.test(handle) ? `https://instagram.com/${handle.toLowerCase()}` : null;
  }
  return canonicalLink(value);
}

export const LINK_HELP = "Paste an Instagram handle like @yourshop, or your Facebook page or website link.";

// Web endings people commonly use for a business site. Anything else after a dot
// ("raj.sojitra17", "av.madhuram.sandwich") is more likely an Instagram handle.
const WEB_ENDINGS = new Set(
  ("com in co net org io info biz me us uk au ca de ae sg nz app xyz site online website store shop cafe coffee " +
    "restaurant bar pizza kitchen salon beauty fitness gym yoga fashion clothing studio design tech live life " +
    "world today space club events travel")
    .split(" "),
);

/**
 * Every reading of what was pasted, most likely first. Text like "monsoon.beans" could be an
 * Instagram handle (they may contain dots) or a website, so both are returned to be checked:
 * a common web ending such as ".com" or ".in" puts the website first, anything else Instagram.
 */
export function linkCandidates(input: string): string[] {
  const value = input.trim();
  const primary = parseBusinessLink(value);
  const ambiguous = /^[a-z0-9._]{1,30}$/i.test(value) && value.includes(".") && !/^\.|\.$|\.\./.test(value);
  if (!ambiguous) return primary ? [primary] : [];
  const instagram = `https://instagram.com/${value.toLowerCase()}`;
  const website = canonicalLink(value);
  const ending = value.split(".").pop()!.toLowerCase();
  const ordered = WEB_ENDINGS.has(ending) ? [website, instagram] : [instagram, website];
  return ordered.filter((l): l is string => !!l);
}

export type Platform = "Instagram" | "Facebook" | "Website";

export function platformOf(link: string): Platform {
  const host = new URL(link).hostname;
  if (host === "instagram.com") return "Instagram";
  if (host === "facebook.com" || host === "fb.com") return "Facebook";
  return "Website";
}

/** "https://instagram.com/monsoonbeans" → "instagram.com/monsoonbeans". */
export const displayLink = (link: string) => link.replace(/^https:\/\//, "");

/** How a business's link reads in a list: "@monsoonbeans", "facebook.com/brewlane" or "brewlane.in". */
export function shortLink(url: string): string {
  const link = canonicalLink(url);
  if (!link) return url;
  const { hostname, pathname } = new URL(link);
  if (hostname === "instagram.com" && pathname.length > 1) return `@${pathname.slice(1)}`;
  return SOCIAL_HOSTS.has(hostname) ? displayLink(link) : hostname;
}

/** 175000 → "175K followers", 871 → "871 followers". */
export function formatFollowers(n: number): string {
  const count = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return `${count} follower${n === 1 ? "" : "s"}`;
}
