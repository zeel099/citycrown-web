// Business locations and distances. Pure: used in the browser and on the server.

export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { address: string };

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line ("as the crow flies") distance in km, by the haversine formula. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 0.65 → "650 m", 2.34 → "2.3 km", 27.8 → "28 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Opens Google Maps (the app on phones) with a route from wherever the visitor is. */
export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
}

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180 && !(p.lat === 0 && p.lng === 0);
}

const MAPS_HOSTS = /^(?:www\.|maps\.)?google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/;

/** A Google Maps link, including share links (maps.app.goo.gl) that still need to be followed. */
export function isMapsLink(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return MAPS_HOSTS.test(url.hostname) && (url.hostname !== "goo.gl" || url.pathname.startsWith("/maps")) && (!/google\./.test(url.hostname) || /\/maps|^maps\./.test(url.hostname + url.pathname));
  } catch {
    return false;
  }
}

/**
 * Coordinates from a full Google Maps link. A place's own pin (!3d…!4d…) wins over the
 * map centre (@lat,lng); "q=" / "ll=" / "query=" links give the point directly.
 */
export function coordsFromMapsLink(input: string): LatLng | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const text = decodeURIComponent(url.pathname + url.search);
  const pick = (lat: string, lng: string) => {
    const p = { lat: Number(lat), lng: Number(lng) };
    return isValidLatLng(p) ? p : null;
  };
  const num = "(-?\\d{1,3}\\.\\d+)";
  const pin = text.match(new RegExp(`!3d${num}!4d${num}`));
  if (pin) return pick(pin[1], pin[2]);
  for (const key of ["q", "query", "ll", "destination", "center"]) {
    const m = url.searchParams.get(key)?.match(new RegExp(`^\\s*${num}\\s*,\\s*${num}\\s*$`));
    if (m) return pick(m[1], m[2]);
  }
  const at = text.match(new RegExp(`@${num},${num}`));
  if (at) return pick(at[1], at[2]);
  const place = text.match(new RegExp(`/(?:place|search)/${num},\\+?${num}`));
  return place ? pick(place[1], place[2]) : null;
}
