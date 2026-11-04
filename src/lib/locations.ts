import { z } from "zod";
import { db } from "./db";
import { distanceKm, formatDistance, isValidLatLng, type Place } from "./geo";
import { UserError } from "./http";
import { sameBusiness } from "./listings";

// Business locations from their owners (claim bar, Add your business, verification) or staff.

/** Farther than this from the city centre is almost certainly the wrong place. */
export const CITY_RADIUS_KM = 60;

export const LocationInput = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().trim().max(300).default(""),
});

type City = { name: string; latitude: number | null; longitude: number | null };

/** A location an owner gave, checked: real coordinates, and within the board's city. Throws UserError. */
export function checkLocation(input: { lat: number; lng: number; address?: string } | null | undefined, city: City): Place {
  if (!input || !isValidLatLng(input)) throw new UserError("Add your business location: search your address, use your current location or paste a Google Maps link.");
  if (city.latitude != null && city.longitude != null) {
    const away = distanceKm(input, { lat: city.latitude, lng: city.longitude });
    if (away > CITY_RADIUS_KM) throw new UserError(`That location is ${formatDistance(away)} from ${city.name}. Pick where your business is in ${city.name}.`);
  }
  return { lat: input.lat, lng: input.lng, address: (input.address ?? "").trim().slice(0, 300) };
}

/** Location fields for a listing row. */
export const locationData = (p: Place) => ({ latitude: p.lat, longitude: p.lng, address: p.address || null });

/** Saves a location on every board the business is on (All-time and Today). */
export async function saveLocation(listingId: string, place: Place): Promise<void> {
  const listing = await db.listing.findUniqueOrThrow({ where: { id: listingId }, include: { board: true } });
  await db.listing.updateMany({ where: sameBusiness(listing), data: locationData(place) });
}

/** Reads <prefix>Lat / <prefix>Lng / <prefix>Address from a form, as sent by LocationPicker. */
export function locationFromForm(form: FormData, prefix = "location"): { lat: number; lng: number; address: string } | null {
  const lat = Number(form.get(`${prefix}Lat`));
  const lng = Number(form.get(`${prefix}Lng`));
  if (!form.get(`${prefix}Lat`) || !isValidLatLng({ lat, lng })) return null;
  return { lat, lng, address: String(form.get(`${prefix}Address`) ?? "").slice(0, 300) };
}
