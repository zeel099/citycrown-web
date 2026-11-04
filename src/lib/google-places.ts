// FR-BRD-09: Google rating and review count on board cards, from the Places API (New).
import { db } from "./db";

const PLACES_URL = "https://places.googleapis.com/v1/places/";

export type PlaceRating = { rating: number; reviews: number };

/** Rating for one place, or null when Google has none (or doesn't know the ID). */
export async function fetchPlaceRating(placeId: string, apiKey: string): Promise<PlaceRating | null> {
  const res = await fetch(PLACES_URL + encodeURIComponent(placeId), {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "rating,userRatingCount" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Google Places returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { rating?: number; userRatingCount?: number };
  if (typeof data.rating !== "number") return null;
  return { rating: Math.round(data.rating * 10) / 10, reviews: data.userRatingCount ?? 0 };
}

/**
 * Refreshes googleRating and googleReviews on every listing with a Place ID.
 * A business sits on several boards (All-time, Today), so each place is fetched once.
 * Does nothing without GOOGLE_PLACES_API_KEY.
 */
export async function refreshGoogleRatings(log: (msg: string) => void = () => {}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    log("GOOGLE_PLACES_API_KEY is not set; skipping.");
    return { places: 0, updated: 0, failed: 0 };
  }
  const places = await db.listing.findMany({
    where: { googlePlaceId: { not: null }, status: { in: ["LIVE", "FROZEN"] } },
    select: { googlePlaceId: true },
    distinct: ["googlePlaceId"],
  });
  let updated = 0;
  let failed = 0;
  for (const { googlePlaceId } of places) {
    const placeId = googlePlaceId!;
    try {
      const rating = await fetchPlaceRating(placeId, apiKey);
      const { count } = await db.listing.updateMany({
        where: { googlePlaceId: placeId },
        data: { googleRating: rating?.rating ?? null, googleReviews: rating?.reviews ?? null },
      });
      updated += count;
      log(`${placeId}: ${rating ? `★ ${rating.rating} (${rating.reviews})` : "no rating"}`);
    } catch (err) {
      failed++;
      log(`${placeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { places: places.length, updated, failed };
}
