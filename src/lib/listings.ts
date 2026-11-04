import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { UserError } from "./http";
import { checkLink, type LinkCheck } from "./link-check";
import { canonicalLink, LINK_HELP, parseBusinessLink } from "./business-link";
import type { Place } from "./geo";
import { checkLocation, locationData } from "./locations";
import { checkOnline } from "./online-check";
import { normalizeName } from "./slug";

export { canonicalLink, LINK_HELP, parseBusinessLink };

export type ListingLinks = { websiteUrl?: string; instagramUrl?: string; facebookUrl?: string };

/** Accepts "instagram.com/shop" or a full URL; returns a normalised https URL or null. */
export function cleanUrl(input?: string | null): string | null {
  const value = input?.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!url.hostname.includes(".")) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

/** The listing on a board (any status) whose stored links match a pasted link, if any. */
export async function findByLink(boardId: string, link: string) {
  const listings = await db.listing.findMany({ where: { boardId } });
  return listings.find((l) => [l.websiteUrl, l.instagramUrl, l.facebookUrl].some((u) => u && canonicalLink(u) === link)) ?? null;
}

/** Statuses a pasted link can't be bid on: frozen after a report, or rejected or removed by staff. */
export const BLOCKED: ReadonlySet<string> = new Set(["FROZEN", "REJECTED", "REMOVED"]);

/**
 * The listing a claim-bar bid goes to: the business already on this board, or a new one
 * created on every board of the city and category as AWAITING_PAYMENT. It goes live
 * when its first bid is paid (see confirmPayment). A new business's link must exist
 * online; if Instagram, Facebook or the site can't be reached, staff check it instead.
 * `recheck` lists listings whose link still needs the background link check.
 */
export async function listingForClaim(input: { boardId: string; name: string; link: string; email: string; location?: { lat: number; lng: number; address?: string } | null }) {
  const link = parseBusinessLink(input.link);
  if (!link) throw new UserError(LINK_HELP);
  const board = await db.board.findUnique({ where: { id: input.boardId }, include: { city: true, category: true } });
  if (!board?.active || !board.city.active || !board.category.active || board.category.banned) throw new UserError("That board isn't open.");

  const byLink = await findByLink(board.id, link);
  if (byLink) {
    if (BLOCKED.has(byLink.status)) throw new UserError(`${byLink.name} can't take bids right now.`);
    // A business added earlier whose payment never went through takes the location given now.
    if (byLink.status !== "LIVE" && input.location && byLink.latitude == null) {
      await db.listing.updateMany({ where: sameBusiness({ ...byLink, board }), data: locationData(checkLocation(input.location, board.city)) });
    }
    return { listing: byLink, recheck: [] as string[], url: link };
  }

  const name = input.name.trim();
  if (!name) throw new UserError("Add your business name.");
  const normalizedName = normalizeName(name);
  const byName = await db.listing.findUnique({ where: { boardId_normalizedName: { boardId: board.id, normalizedName } } });
  // A rejected, removed or never-paid listing with this name is replaced; anything else is a different business.
  if (byName && byName.status !== "REJECTED" && byName.status !== "REMOVED" && byName.status !== "AWAITING_PAYMENT") {
    throw new UserError(`${byName.name} is already on this board with a different link. Find it on the board and bid on it there.`);
  }

  // Every business on a board has a location, so customers can see how far it is (Instagram-only ones too).
  const place = checkLocation(input.location, board.city);
  const online = await checkOnline(link);
  if (online.status === "missing") throw new UserError(online.message);

  const boards = await db.board.findMany({ where: { cityId: board.cityId, categoryId: board.categoryId, active: true }, select: { id: true } });
  const found = online.status === "found";
  const listings = await createOnBoards(boards, {
    name,
    normalizedName,
    links: classifyLink(link),
    email: input.email,
    status: "AWAITING_PAYMENT",
    check: found ? { ok: true, note: `Found on ${online.platform}${online.name ? `: ${online.name}` : ""}` } : { ok: null, note: online.message },
    location: place,
  });
  return { listing: listings.find((l) => l.boardId === board.id)!, recheck: found ? [] : listings.map((l) => l.id), url: link };
}

type NewBusiness = {
  name: string;
  normalizedName: string;
  links: ListingLinks;
  email: string | null;
  status: "PENDING" | "AWAITING_PAYMENT";
  check?: { ok: boolean | null; note: string }; // FR-ADM-03 result already known at creation
  location: Place;
};

/** Lists a business on each of the given boards. A rejected or removed listing with the same name is replaced, not duplicated. */
function createOnBoards(boards: { id: string }[], b: NewBusiness) {
  const data = {
    name: b.name,
    normalizedName: b.normalizedName,
    websiteUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    ...b.links,
    submitterEmail: b.email,
    status: b.status,
    rejectReason: null,
    linkCheckOk: b.check?.ok ?? null,
    linkCheckNote: b.check?.note ?? null,
    linkCheckedAt: b.check ? new Date() : null,
    ...locationData(b.location),
  };
  return db.$transaction(
    boards.map((board) =>
      db.listing.upsert({
        where: { boardId_normalizedName: { boardId: board.id, normalizedName: b.normalizedName } },
        create: { boardId: board.id, ...data },
        update: data,
      }),
    ),
  );
}

/** Sorts a single "link" field into the right column by host. */
export function classifyLink(url: string): ListingLinks {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "instagram.com") return { instagramUrl: url };
  if (host === "facebook.com" || host === "fb.com") return { facebookUrl: url };
  return { websiteUrl: url };
}

/** The link a listing was submitted with. */
export function listingUrl(l: { websiteUrl: string | null; instagramUrl: string | null; facebookUrl: string | null }) {
  return l.websiteUrl ?? l.instagramUrl ?? l.facebookUrl;
}

/** A business has one listing per board of its city and category (All-time and Today). */
export function sameBusiness(l: { normalizedName: string; board: { cityId: string; categoryId: string } }): Prisma.ListingWhereInput {
  return { normalizedName: l.normalizedName, board: { cityId: l.board.cityId, categoryId: l.board.categoryId } };
}

/**
 * FR-LST-01..04: new listings need a link, are de-duplicated per city and category, and wait
 * for moderation. One submission lists the business on every open board of that city and
 * category, so it shows on All-time and Today alike.
 */
export async function submitListing(input: {
  city: string;
  category: string;
  name: string;
  link: string;
  email?: string | null;
  location?: { lat: number; lng: number; address?: string } | null;
}) {
  const name = input.name.trim();
  if (!name) throw new UserError("Add your business name.");
  const url = cleanUrl(input.link);
  if (!url) throw new UserError("Add a website, Instagram or Facebook link, for example instagram.com/yourshop.");

  const category = await db.category.findUnique({ where: { slug: input.category } });
  if (category?.banned) throw new UserError("Listings in this category aren't allowed.");
  const boards = await db.board.findMany({
    where: { active: true, city: { slug: input.city, active: true }, category: { slug: input.category, active: true, banned: false } },
    include: { city: true, category: true },
    orderBy: { type: "asc" },
  });
  if (!boards.length) throw new UserError("That board isn't open yet.");

  const links = classifyLink(url);
  const normalizedName = normalizeName(name);
  // A claim-bar business whose payment never went through isn't on the board, so it can be submitted for free.
  const duplicate = await db.listing.findFirst({
    where: {
      boardId: { in: boards.map((b) => b.id) },
      status: { notIn: ["REJECTED", "REMOVED", "AWAITING_PAYMENT"] },
      OR: [{ normalizedName }, ...Object.entries(links).map(([k, v]) => ({ [k]: v }))],
    },
  });
  if (duplicate) throw new UserError(`${duplicate.name} is already on this board. You can bid on it instead.`);

  const location = checkLocation(input.location, boards[0].city);
  const listings = await createOnBoards(boards, { name, normalizedName, links, email: input.email ?? null, status: "PENDING", location });
  return { listings, url, city: boards[0].city.name, category: boards[0].category.name };
}

/** Copies a business onto any open board of its city and category it isn't on yet, e.g. a board opened after it was submitted. */
export async function fillMissingBoards(listingId: string) {
  const l = await db.listing.findUniqueOrThrow({ where: { id: listingId }, include: { board: true } });
  const boards = await db.board.findMany({
    where: { cityId: l.board.cityId, categoryId: l.board.categoryId, active: true, listings: { none: { normalizedName: l.normalizedName } } },
    select: { id: true },
  });
  if (!boards.length) return;
  const copy = {
    name: l.name,
    normalizedName: l.normalizedName,
    websiteUrl: l.websiteUrl,
    instagramUrl: l.instagramUrl,
    facebookUrl: l.facebookUrl,
    phone: l.phone,
    googlePlaceId: l.googlePlaceId,
    status: l.status,
    submitterEmail: l.submitterEmail,
    ownerUserId: l.ownerUserId,
    verifiedAt: l.verifiedAt,
    linkCheckOk: l.linkCheckOk,
    linkCheckNote: l.linkCheckNote,
    linkCheckedAt: l.linkCheckedAt,
  };
  await db.listing.createMany({ data: boards.map((b) => ({ ...copy, boardId: b.id })), skipDuplicates: true });
}

/** FR-ADM-03: runs the link check and stores it on the given listings. Never throws. */
export async function recordLinkCheck(listingIds: string[], url: string): Promise<LinkCheck | null> {
  try {
    const result = await checkLink(url);
    await db.listing.updateMany({
      where: { id: { in: listingIds } },
      data: { linkCheckOk: result.ok, linkCheckNote: result.note, linkCheckedAt: new Date() },
    });
    return result;
  } catch (err) {
    console.error("Link check failed", err);
    return null;
  }
}
