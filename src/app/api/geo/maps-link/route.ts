import { NextResponse } from "next/server";
import { sessionHash } from "@/lib/events";
import { isMapsLink } from "@/lib/geo";
import { resolveMapsLink, reversePlace } from "@/lib/geocode";
import { allowGeocode } from "@/lib/rate-limit";

const HELP = "Paste a Google Maps link, like https://maps.app.goo.gl/… from the Share button.";

/** Location picker: the place a Google Maps link points at, with its address. */
export async function GET(req: Request) {
  const link = (new URL(req.url).searchParams.get("url") ?? "").trim().slice(0, 2000);
  if (!isMapsLink(link)) return NextResponse.json({ error: HELP }, { status: 400 });
  if (!allowGeocode(sessionHash(req))) return NextResponse.json({ error: "Too many lookups. Wait a moment and try again." }, { status: 429 });
  const at = await resolveMapsLink(link).catch(() => null);
  if (!at) return NextResponse.json({ error: "We couldn't read a location from that link. Open the place in Google Maps, tap Share and copy the link." }, { status: 404 });
  const place = await reversePlace(at).catch(() => null);
  return NextResponse.json({ place: { ...at, address: place?.address ?? `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}` } });
}
