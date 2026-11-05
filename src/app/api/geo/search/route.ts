import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionHash } from "@/lib/events";
import { searchPlaces } from "@/lib/geocode";
import { allowGeocode } from "@/lib/rate-limit";

/** Location picker: addresses matching what the owner typed, nearest to the board's city first. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ places: [] });
  if (!allowGeocode(sessionHash(req))) return NextResponse.json({ error: "Too many searches. Wait a moment and try again." }, { status: 429 });
  const city = params.get("city") ? await db.city.findUnique({ where: { slug: params.get("city")! } }) : null;
  const near = city?.latitude != null && city.longitude != null ? { lat: city.latitude, lng: city.longitude } : null;
  try {
    return NextResponse.json({ places: await searchPlaces(city && !q.toLowerCase().includes(city.name.toLowerCase()) ? `${q}, ${city.name}` : q, near) });
  } catch (err) {
    console.error("[geo] search", err);
    return NextResponse.json({ error: "Address search isn't answering right now. Use your current location or a Google Maps link." }, { status: 502 });
  }
}
