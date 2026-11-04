import { coordsFromMapsLink, isMapsLink, isValidLatLng, type LatLng, type Place } from "./geo";
import { fetchPublicPage } from "./verification";

// Address search for business locations, from OpenStreetMap through Photon (photon.komoot.io),
// which allows search-as-you-type. Set GEOCODER_URL to use your own Photon server.

const GEOCODER = (process.env.GEOCODER_URL || "https://photon.komoot.io").replace(/\/$/, "");
const HEADERS = { "user-agent": "BestInTheCity/1.0 (business location search)", accept: "application/json" };

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

/** "Domino's, 12 Ring Road, Udhana, Surat, Gujarat" from an OpenStreetMap feature. */
export function placeLabel(p: Feature["properties"]): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const parts = [p.name, street, p.locality ?? p.district, p.city ?? p.county, p.state];
  return [...new Set(parts.filter((s): s is string => !!s && s.trim().length > 0))].join(", ");
}

function toPlace(f: Feature): Place | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const place = { lat, lng, address: placeLabel(f.properties ?? {}) };
  return isValidLatLng(place) && place.address ? place : null;
}

const store = globalThis as unknown as { __bitcGeo?: Map<string, { places: Place[]; at: number }> };
const cache = (store.__bitcGeo ??= new Map<string, { places: Place[]; at: number }>());
const TTL_MS = 60 * 60e3;

async function photon(path: string): Promise<Place[]> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places;
  const res = await fetch(`${GEOCODER}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Address search answered ${res.status}`);
  const data = (await res.json()) as { features?: Feature[] };
  const places = (data.features ?? []).map(toPlace).filter((p): p is Place => !!p);
  if (cache.size > 2000) cache.clear();
  cache.set(path, { places, at: Date.now() });
  return places;
}

/** Up to 6 places matching what the owner typed, nearest to `near` (the board's city) first. */
export function searchPlaces(query: string, near?: LatLng | null): Promise<Place[]> {
  const params = new URLSearchParams({ q: query.trim().slice(0, 120), limit: "6", lang: "en" });
  if (near) {
    params.set("lat", near.lat.toFixed(4));
    params.set("lon", near.lng.toFixed(4));
  }
  return photon(`/api/?${params}`);
}

/** The nearest address to a point, e.g. the owner's current location. */
export async function reversePlace(at: LatLng): Promise<Place | null> {
  const places = await photon(`/reverse?lat=${at.lat.toFixed(6)}&lon=${at.lng.toFixed(6)}&lang=en&limit=1`);
  return places[0] ? { ...places[0], lat: at.lat, lng: at.lng } : null;
}

/**
 * Coordinates from a Google Maps link. Share links (maps.app.goo.gl) are followed, with the
 * same safety rules as link checks, to the full link that carries the coordinates.
 */
export async function resolveMapsLink(link: string): Promise<LatLng | null> {
  if (!isMapsLink(link)) return null;
  const direct = coordsFromMapsLink(link);
  if (direct) return direct;
  const page = await fetchPublicPage(link);
  if (!page.ok) return null;
  const fromUrl = coordsFromMapsLink(page.url);
  if (fromUrl) return fromUrl;
  // A place page's preview image is a static map centred on the place.
  const center = page.body.slice(0, 200_000).match(/center=(-?\d{1,3}\.\d+)%2C(-?\d{1,3}\.\d+)/);
  const p = center ? { lat: Number(center[1]), lng: Number(center[2]) } : null;
  return isValidLatLng(p) ? p : null;
}
