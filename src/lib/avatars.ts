import { canonicalLink } from "./business-link";
import { db } from "./db";
import { sameBusiness } from "./listings";
import { avatarFor, checkOnline } from "./online-check";

// What the board shows about a business from its own profile: the Instagram or Facebook
// profile picture (or website icon) and its Instagram follower count. Saved when the
// business is paid for (see createBid and notifyConfirmed) or approved by staff.

const FOLLOWERS_MAX_AGE_MS = 24 * 3600e3;

/** The link a business's picture comes from: a social profile first (usually its logo), then its website. */
export function pictureLink(l: { instagramUrl: string | null; facebookUrl: string | null; websiteUrl: string | null }): string | null {
  const raw = l.instagramUrl ?? l.facebookUrl ?? l.websiteUrl;
  return raw ? canonicalLink(raw) : null;
}

/**
 * Saves the picture (if the business has none) and refreshes its Instagram follower count
 * (if older than a day), on every board the business is on. Seed listings are skipped:
 * their links are placeholders. Returns whether anything was saved. Never throws.
 */
export async function refreshProfile(listingId: string): Promise<boolean> {
  try {
    const listing = await db.listing.findUnique({ where: { id: listingId }, include: { board: true, avatar: { select: { listingId: true } } } });
    if (!listing || listing.isSeed) return false;
    const picture = listing.avatar ? null : pictureLink(listing);
    const instagram = listing.instagramUrl ? canonicalLink(listing.instagramUrl) : null;
    const followersDue = !!instagram && (!listing.followersCheckedAt || Date.now() - listing.followersCheckedAt.getTime() > FOLLOWERS_MAX_AGE_MS);
    if (!picture && !followersDue) return false;

    const siblings = (await db.listing.findMany({ where: sameBusiness(listing), select: { id: true } })).map((s) => s.id);
    let saved = false;
    if (followersDue && instagram) {
      const online = await checkOnline(instagram);
      if (online.status === "found" && online.followers !== null) {
        await db.listing.updateMany({ where: { id: { in: siblings } }, data: { instagramFollowers: online.followers, followersCheckedAt: new Date() } });
        saved = true;
      }
    }
    if (picture) {
      const image = await avatarFor(picture, () => true);
      if (image) {
        await db.listingAvatar.createMany({
          data: siblings.map((id) => ({ listingId: id, bytes: new Uint8Array(image.bytes), type: image.type, sourceUrl: picture })),
          skipDuplicates: true,
        });
        saved = true;
      }
    }
    return saved;
  } catch (err) {
    console.error(`[profile] ${listingId}`, err);
    return false;
  }
}

/** Picture URLs for the listings that have one, versioned so a new picture isn't served from cache. */
export async function avatarUrls(listingIds: string[]): Promise<Map<string, string>> {
  if (!listingIds.length) return new Map();
  const rows = await db.listingAvatar.findMany({ where: { listingId: { in: listingIds } }, select: { listingId: true, updatedAt: true } });
  return new Map(rows.map((r) => [r.listingId, `/api/listings/${r.listingId}/avatar?v=${r.updatedAt.getTime().toString(36)}`]));
}
