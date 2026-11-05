"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { directionsUrl, distanceKm, formatDistance, type LatLng, type Place } from "@/lib/geo";

const LeafletMap = dynamic(() => import("../map/LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="leaflet-host listing-map is-loading" />,
});

/** Distance from the visitor, shown on the card once they've shared their location. */
export function ListingDistance({ location, here }: { location: Place | null; here: LatLng | null }) {
  if (!location || !here) return null;
  return (
    <span className="listing-distance">
      <span className="location-pin" aria-hidden="true" />
      {formatDistance(distanceKm(here, location))}
      <span className="visually-hidden"> from you</span>
    </span>
  );
}

/** Where the business is, inside an opened card: address, distance, a map and directions. */
export function ListingLocation({ listingId, name, location, here }: { listingId: string; name: string; location: Place | null; here: LatLng | null }) {
  if (!location) {
    return (
      <div className="listing-location">
        <p className="muted">
          {name} hasn&apos;t added its location yet. Own it?{" "}
          <Link className="text-link" href={`/verify/${listingId}`}>
            Add it when you verify
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="listing-location">
      <div className="listing-location-meta">
        <p className="location-address">
          <span className="location-pin" aria-hidden="true" />
          <span>{location.address || "Location on the map"}</span>
        </p>
        <span className="muted">{here ? `${formatDistance(distanceKm(here, location))} from you in a straight line` : "Tap “Distance from me” above to see how far it is."}</span>
      </div>
      <a className="btn btn-primary btn-sm" href={directionsUrl(location)} target="_blank" rel="noopener noreferrer">
        Directions
      </a>
      <LeafletMap className="listing-map" center={location} marker={location} zoom={15} label={`Map showing where ${name} is: ${location.address}`} />
    </div>
  );
}
