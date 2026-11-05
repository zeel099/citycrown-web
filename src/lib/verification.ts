import crypto from "node:crypto";
import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import { Prisma, type Listing, type Verification, type VerificationMethod } from "@prisma/client";
import { db } from "./db";
import type { Place } from "./geo";
import { checkLocation } from "./locations";

// Owner verification (FR-LST-05): the owner publishes a per-user code on the
// listing's own website or social profile and we look for it. Only URLs
// stored on the listing are ever fetched, never anything the user types.

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
export const WELL_KNOWN_PATH = "/.well-known/bitc-verification.txt";
export const META_NAME = "bitc-verification";

export const METHODS = {
  WEBSITE: { field: "websiteUrl", label: "Website", slug: "website" },
  INSTAGRAM: { field: "instagramUrl", label: "Instagram", slug: "instagram" },
  FACEBOOK: { field: "facebookUrl", label: "Facebook", slug: "facebook" },
} as const satisfies Record<VerificationMethod, { field: keyof Listing; label: string; slug: string }>;

type ListingLinks = Pick<Listing, "websiteUrl" | "instagramUrl" | "facebookUrl">;

/** e.g. BITC-4V8DFH34 */
export function generateVerificationCode(): string {
  return `BITC-${Array.from({ length: 8 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("")}`;
}

/** Methods the listing has a link for, in tab order. */
export function availableMethods(listing: ListingLinks): VerificationMethod[] {
  return (Object.keys(METHODS) as VerificationMethod[]).filter((m) => !!listing[METHODS[m].field]);
}

export function methodFromSlug(slug: string | undefined | null): VerificationMethod | null {
  return (Object.keys(METHODS) as VerificationMethod[]).find((m) => METHODS[m].slug === slug) ?? null;
}

const isSocial = (method: VerificationMethod) => method !== "WEBSITE";

// ---- matching -------------------------------------------------------------

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** True when the document's <head> has <meta name="bitc-verification" content="CODE">. */
export function headHasCode(html: string, code: string): boolean {
  const head = html.split(/<body[\s>]/i)[0];
  return (head.match(/<meta\b[^>]*>/gi) ?? []).some(
    (tag) => attr(tag, "name")?.trim().toLowerCase() === META_NAME && attr(tag, "content")?.trim().toUpperCase() === code.toUpperCase(),
  );
}

/** True when the code appears as a whole token, e.g. in a profile bio or the well-known text file. */
export function textHasCode(text: string, code: string): boolean {
  return new RegExp(`(^|[^A-Z0-9-])${code.replace(/[^A-Z0-9-]/gi, "")}($|[^A-Z0-9])`, "i").test(text);
}

// ---- safe fetching ---------------------------------------------------------

const blocked = new net.BlockList();
for (const [subnet, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(subnet, prefix, "ipv4");
for (const [subnet, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(subnet, prefix, "ipv6");

/** Loopback, private, link-local, carrier-grade NAT, multicast, documentation and tunnelling ranges. */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return true;
  return blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

/** Resolves like dns.lookup but refuses hosts with any non-public address, so a fetch can't reach internal services. */
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family ?? 0 }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(Object.assign(new Error(`${hostname} is not a public address`), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

/** url is where redirects ended; notFound means the host name doesn't exist (DNS). */
export type FetchResult = { ok: true; status: number; body: string; url: string } | { ok: false; reason: string; notFound?: true };

const LIMITS = { timeoutMs: 6000, maxBytes: 512 * 1024, maxRedirects: 3 };

/** The URL as https on the default port, or null if it can't be fetched safely. */
export function safeHttpsUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) return null;
  url.hash = "";
  return url;
}

type Raw = { status: number; location?: string; body: Buffer; type: string };

function getOnce(url: URL, deadline: number, maxBytes: number, accept: string): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      lookup: publicLookup,
      headers: {
        "user-agent": "BestInTheCityVerifier/1.0 (+owner verification)",
        accept,
        "accept-encoding": "identity",
      },
    });
    const timer = setTimeout(() => req.destroy(new Error("timed out")), Math.max(0, deadline - Date.now()));
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on("response", (res) => {
      const status = res.statusCode ?? 0;
      const type = String(res.headers["content-type"] ?? "").toLowerCase();
      if (status >= 300 && status < 400) {
        clearTimeout(timer);
        res.destroy();
        return resolve({ status, location: res.headers.location, body: Buffer.alloc(0), type });
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const done = () => {
        clearTimeout(timer);
        resolve({ status, body: Buffer.concat(chunks).subarray(0, maxBytes), type });
      };
      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size >= maxBytes) res.destroy();
      });
      res.on("close", done);
      res.on("error", done);
    });
    req.end();
  });
}

const PAGE_ACCEPT = "text/html,text/plain;q=0.9,*/*;q=0.5";

/**
 * GETs a public https page: short timeout, capped body size, at most three
 * redirects, each to https and a public address.
 */
export async function fetchPublicPage(raw: string): Promise<FetchResult> {
  const res = await fetchPublic(raw, LIMITS.maxBytes, PAGE_ACCEPT);
  return res.ok ? { ok: true, status: res.status, body: res.body.toString("utf8"), url: res.url } : res;
}

/** Same safety rules as fetchPublicPage, for a small image (a profile picture or site icon). */
export async function fetchPublicImage(raw: string, maxBytes = 256 * 1024): Promise<{ bytes: Buffer; type: string } | null> {
  const res = await fetchPublic(raw, maxBytes + 1, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8");
  if (!res.ok || res.status !== 200 || res.body.length > maxBytes || !res.body.length) return null;
  return { bytes: res.body, type: res.type.split(";")[0].trim() };
}

async function fetchPublic(raw: string, maxBytes: number, accept: string): Promise<(Raw & { ok: true; url: string }) | Extract<FetchResult, { ok: false }>> {
  let url = safeHttpsUrl(raw);
  if (!url) return { ok: false, reason: "the link isn't a public https address" };
  const deadline = Date.now() + LIMITS.timeoutMs;
  try {
    for (let hop = 0; ; hop++) {
      const res = await getOnce(url, deadline, maxBytes, accept);
      if (!res.location) return { ...res, ok: true, url: url.toString() };
      if (hop >= LIMITS.maxRedirects) return { ok: false, reason: "too many redirects" };
      const next = new URL(res.location, url);
      if (next.protocol !== "https:") return { ok: false, reason: "it redirects to an insecure address" };
      url = safeHttpsUrl(next.toString());
      if (!url) return { ok: false, reason: "it redirects to an address we can't check" };
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EBLOCKED") return { ok: false, reason: "it isn't a public address" };
    if (code === "ENOTFOUND") return { ok: false, reason: "the address doesn't exist", notFound: true };
    return { ok: false, reason: (err as Error).message === "timed out" ? "it took too long to answer" : "it couldn't be reached" };
  }
}

// ---- checking --------------------------------------------------------------

export type CheckOutcome = { kind: "found" | "missing" | "unreadable"; note: string };

export const UNREADABLE_PROFILE = "The profile couldn't be read automatically. Send it for review and our team will check it.";

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Looks for the code where the method says it should be, on the listing's stored link only. */
export async function findCodeOnListing(listing: ListingLinks, method: VerificationMethod, code: string): Promise<CheckOutcome> {
  const link = listing[METHODS[method].field];
  if (!link) return { kind: "unreadable", note: `This business has no ${METHODS[method].label} link.` };

  if (isSocial(method)) {
    const page = await fetchPublicPage(link);
    return page.ok && page.status === 200 && textHasCode(page.body, code)
      ? { kind: "found", note: "Code found on the profile." }
      : { kind: "unreadable", note: UNREADABLE_PROFILE };
  }

  const base = safeHttpsUrl(link);
  if (!base) return { kind: "unreadable", note: `We can't check ${hostOf(link)}: the link isn't a public https address.` };
  const pages = [...new Set([base.toString(), new URL("/", base).toString()])];
  const [file, ...htmls] = await Promise.all([fetchPublicPage(new URL(WELL_KNOWN_PATH, base).toString()), ...pages.map(fetchPublicPage)]);
  if (htmls.some((p) => p.ok && p.status === 200 && headHasCode(p.body, code))) return { kind: "found", note: "Meta tag found." };
  if (file.ok && file.status === 200 && textHasCode(file.body.slice(0, 4096), code)) return { kind: "found", note: "Verification file found." };

  const failure = [...htmls, file].find((p): p is Extract<FetchResult, { ok: false }> => !p.ok);
  if (failure && !htmls.some((p) => p.ok)) {
    return { kind: "unreadable", note: `We couldn't reach ${base.host}: ${failure.reason}. Check the site is online and try again.` };
  }
  return { kind: "missing", note: `We couldn't find ${code} on ${base.host} yet. Check the tag is inside <head> or the file is published, then try again.` };
}

/**
 * One verification per listing, with one code whichever method is used. No account
 * is needed: publishing the code on the listing's own link is the proof of ownership.
 */
export async function getOrCreateVerification(listingId: string, method: VerificationMethod): Promise<Verification> {
  const existing = await db.verification.findUnique({ where: { listingId } });
  if (existing) return existing;
  try {
    return await db.verification.create({ data: { listingId, method, code: generateVerificationCode() } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return db.verification.findUniqueOrThrow({ where: { listingId } });
    }
    throw err;
  }
}

/** The optional email an owner leaves for review updates and outbid alerts. */
async function contactFor(email: string | null | undefined) {
  if (!email) return null;
  return db.user.upsert({ where: { email }, create: { email }, update: {} });
}

const CHECK_COOLDOWN_MS = 10_000;

/** "Check now": fetches the listing's link and verifies the business when the code is there. */
/** The location an owner gave while verifying, if it's valid and in the business's city; it waits on the verification. */
async function pendingLocation(listingId: string, location: Place | null | undefined) {
  if (!location) return {};
  const listing = await db.listing.findUnique({ where: { id: listingId }, include: { board: { include: { city: true } } } });
  try {
    const p = checkLocation(location, listing!.board.city);
    return { pendingLatitude: p.lat, pendingLongitude: p.lng, pendingAddress: p.address || null };
  } catch {
    return {}; // the picker already warns about a location outside the city
  }
}

export async function runVerificationCheck(listingId: string, method: VerificationMethod, email?: string | null, location?: Place | null): Promise<void> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.verifiedAt || !availableMethods(listing).includes(method)) return;
  const v = await getOrCreateVerification(listingId, method);
  if (v.status === "VERIFIED") return;
  if (v.lastCheckedAt && Date.now() - v.lastCheckedAt.getTime() < CHECK_COOLDOWN_MS) return;

  const contact = await contactFor(email);
  const outcome = await findCodeOnListing(listing, method, v.code);
  await db.verification.update({
    where: { id: v.id },
    data: {
      method,
      status: "PENDING",
      lastCheckedAt: new Date(),
      lastCheckNote: outcome.note,
      ...(contact ? { userId: contact.id } : {}),
      ...(await pendingLocation(listingId, location)),
    },
  });
  if (outcome.kind === "found") await markVerified(v.id, `owner:${email ?? "anonymous"}`);
}

/** "Send for review": a social profile we couldn't read goes to the admin queue (IN_REVIEW). */
export async function requestManualReview(listingId: string, method: VerificationMethod, email?: string | null, location?: Place | null): Promise<void> {
  if (!isSocial(method)) return;
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.verifiedAt || !availableMethods(listing).includes(method)) return;
  const v = await getOrCreateVerification(listingId, method);
  if (v.status === "VERIFIED") return;
  const contact = await contactFor(email);
  await db.$transaction([
    db.verification.update({
      where: { id: v.id },
      data: {
        method,
        status: "IN_REVIEW",
        lastCheckNote: v.lastCheckNote ?? "Sent for review by the owner",
        ...(contact ? { userId: contact.id } : {}),
        ...(await pendingLocation(listingId, location)),
      },
    }),
    db.auditLog.create({ data: { actor: `owner:${email ?? "anonymous"}`, action: "verification.review_requested", target: v.id, after: { listingId, method } } }),
  ]);
}

/**
 * Marks a verification as passed: the business gets the Verified badge on every
 * board of its city and category (All-time and Today), and the owner's email, if
 * they left one, becomes the contact for outbid alerts.
 */
export async function markVerified(verificationId: string, actor: string): Promise<void> {
  const v = await db.verification.findUniqueOrThrow({
    where: { id: verificationId },
    include: { listing: { include: { board: true } } },
  });
  const { listing } = v;
  const now = new Date();
  await db.$transaction([
    db.verification.update({ where: { id: v.id }, data: { status: "VERIFIED", lastCheckedAt: now } }),
    db.listing.updateMany({
      where: {
        normalizedName: listing.normalizedName,
        board: { cityId: listing.board.cityId, categoryId: listing.board.categoryId },
      },
      data: {
        verifiedAt: now,
        ...(v.userId ? { ownerUserId: v.userId } : {}),
        // The location the owner gave while verifying, now that they've proven it's their business.
        ...(v.pendingLatitude != null && v.pendingLongitude != null
          ? { latitude: v.pendingLatitude, longitude: v.pendingLongitude, address: v.pendingAddress }
          : {}),
      },
    }),
    ...(v.userId ? [db.user.updateMany({ where: { id: v.userId, role: "BIDDER" }, data: { role: "OWNER" } })] : []),
    db.auditLog.create({ data: { actor, action: "verification.verified", target: v.id, after: { listingId: listing.id, method: v.method } } }),
  ]);
}

export async function rejectVerification(verificationId: string, actor: string, reason: string): Promise<void> {
  await db.$transaction([
    db.verification.update({ where: { id: verificationId }, data: { status: "REJECTED", lastCheckNote: reason } }),
    db.auditLog.create({ data: { actor, action: "verification.rejected", target: verificationId, after: { reason } } }),
  ]);
}
