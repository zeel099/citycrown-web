"use client";

import { useState } from "react";
import type { LatLng, Place } from "@/lib/geo";
import { LocationPicker } from "./LocationPicker";

/** LocationPicker for server-action forms: posts <name>Lat, <name>Lng and <name>Address. */
export function LocationField(props: {
  name: string;
  initial: Place | null;
  city?: { slug: string; name: string; center: LatLng | null };
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState<Place | null>(props.initial);
  return <LocationPicker value={value} onChange={setValue} name={props.name} city={props.city} label={props.label} required={props.required} />;
}
