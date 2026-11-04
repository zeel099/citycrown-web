import { NextResponse } from "next/server";
import { sessionHash } from "@/lib/events";
import { isValidLatLng } from "@/lib/geo";
import { reversePlace } from "@/lib/geocode";
import { allowGeocode } from "@/lib/rate-limit";

/** Location picker: the address at a point (the owner's current location, or where they dropped the pin). */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const at = { lat: Number(params.get("lat")), lng: Number(params.get("lng")) };
  if (!isValidLatLng(at)) return NextResponse.json({ error: "That isn't a valid location." }, { status: 400 });
  if (!allowGeocode(sessionHash(req))) return NextResponse.json({ error: "Too many lookups. Wait a moment and try again." }, { status: 429 });
  try {
    return NextResponse.json({ place: await reversePlace(at) });
  } catch (err) {
    console.error("[geo] reverse", err);
    return NextResponse.json({ place: null });
  }
}
