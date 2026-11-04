"use client";

import { useState } from "react";
import type { LatLng, Place } from "@/lib/geo";
import { SubmitButton } from "../account/SubmitButton";
import { LocationField } from "../map/LocationField";

type Props = {
  listingId: string;
  name: string;
  location: Place | null;
  city: { slug: string; name: string; center: LatLng | null };
  action: (formData: FormData) => Promise<void>;
};

/** Admin: a business's location, with a picker to add or correct it. */
export function LocationEditor({ listingId, name, location, city, action }: Props) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="admin-stack">
        <span className={location ? "" : "admin-sub"}>{location ? location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "No location"}</span>
        <button type="button" className="link-btn" onClick={() => setEditing(true)} aria-label={`${location ? "Change" : "Set"} location for ${name}`}>
          {location ? "Change" : "Set location"}
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="admin-location-form" onSubmit={() => setTimeout(() => setEditing(false), 0)}>
      <input type="hidden" name="id" value={listingId} />
      <LocationField name="location" initial={location} city={city} label={`Location of ${name}`} required />
      <div className="admin-inline">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Saving…">
          Save location
        </SubmitButton>
        <button type="button" className="link-btn" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
