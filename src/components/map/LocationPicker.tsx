"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { distanceKm, formatDistance, isMapsLink, type LatLng, type Place } from "@/lib/geo";

// Leaflet needs the browser, so the map loads on the client only.
const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="leaflet-host location-map is-loading" />,
});

/** How far from the city centre a business can be before we ask the owner to double-check. */
export const CITY_RADIUS_KM = 60;

type Props = {
  value: Place | null;
  onChange: (place: Place | null) => void;
  city?: { slug: string; name: string; center: LatLng | null };
  /** Hidden inputs for server-action forms: <name>Lat, <name>Lng, <name>Address. */
  name?: string;
  required?: boolean;
  label?: string;
};

async function getJson<T>(url: string): Promise<T & { error?: string }> {
  const res = await fetch(url);
  return res.json();
}

/**
 * Where the business is: search an address, use the device's location (handy when the
 * owner is at the shop), or paste a Google Maps link; then drag the pin to the exact spot.
 */
export function LocationPicker({ value, onChange, city, name, required, label = "Business location" }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState<"search" | "here" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState("");
  const searchSeq = useRef(0);

  // Search as the owner types (debounced), biased to the board's city.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || value) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setBusy("search");
      try {
        const data = await getJson<{ places?: Place[] }>(`/api/geo/search?q=${encodeURIComponent(q)}${city ? `&city=${city.slug}` : ""}`);
        if (seq !== searchSeq.current) return;
        setResults(data.places ?? []);
        setError(data.error ?? (data.places?.length ? null : "No matches. Try your street or area name, or use your current location."));
      } catch {
        if (seq === searchSeq.current) setError("Address search isn't answering. Use your current location or a Google Maps link.");
      } finally {
        if (seq === searchSeq.current) setBusy(null);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query, value, city]);

  function choose(place: Place) {
    setResults([]);
    setQuery("");
    setError(null);
    setLinkMode(false);
    onChange(place);
  }

  function useHere() {
    if (!("geolocation" in navigator)) return setError("This browser can't share its location. Search your address instead.");
    setBusy("here");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const data = await getJson<{ place?: Place | null }>(`/api/geo/reverse?lat=${at.lat}&lng=${at.lng}`).catch(() => ({ place: null }) as { place: null });
        setBusy(null);
        choose({ ...at, address: data.place?.address ?? "Your current location" });
      },
      (err) => {
        setBusy(null);
        setError(err.code === err.PERMISSION_DENIED ? "Location access is blocked. Allow it in your browser, or search your address." : "We couldn't get your location. Search your address instead.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function useLink() {
    if (!isMapsLink(link)) return setError("Paste a Google Maps link, like https://maps.app.goo.gl/… from the Share button.");
    setBusy("link");
    setError(null);
    try {
      const data = await getJson<{ place?: Place }>(`/api/geo/maps-link?url=${encodeURIComponent(link.trim())}`);
      if (data.place) choose(data.place);
      else setError(data.error ?? "We couldn't read a location from that link.");
    } catch {
      setError("We couldn't read that link. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function moved(to: LatLng) {
    onChange({ ...to, address: value?.address ?? "" });
    const data = await getJson<{ place?: Place | null }>(`/api/geo/reverse?lat=${to.lat}&lng=${to.lng}`).catch(() => ({ place: null }) as { place: null });
    if (data.place) onChange({ ...to, address: data.place.address });
  }

  const far = value && city?.center ? distanceKm(value, city.center) : 0;

  return (
    <div className="location-picker">
      <span className="field-label" id={`${id}-label`}>
        {label}
        {required && <span className="visually-hidden"> (required)</span>}
      </span>
      {name && value && (
        <>
          <input type="hidden" name={`${name}Lat`} value={value.lat} />
          <input type="hidden" name={`${name}Lng`} value={value.lng} />
          <input type="hidden" name={`${name}Address`} value={value.address} />
        </>
      )}

      {value ? (
        <div className="location-chosen">
          <p className="location-address">
            <span className="location-pin" aria-hidden="true" />
            <span>{value.address || "Pinned on the map"}</span>
            <button type="button" className="link-btn" onClick={() => onChange(null)}>
              Change
            </button>
          </p>
          <LeafletMap
            className="location-map"
            center={value}
            marker={value}
            draggable
            onMove={moved}
            label={`Map of ${value.address || "the business location"}. Drag the pin to the exact spot.`}
          />
          <p className="field-hint">Drag the pin to your entrance if it isn&apos;t exact.</p>
          {far > CITY_RADIUS_KM && city && (
            <p className="notice notice-error" role="alert">
              This spot is {formatDistance(far)} from {city.name}. Pick a location in {city.name}.
            </p>
          )}
        </div>
      ) : (
        <div className="location-find">
          <div className="location-search">
            <input
              className="input"
              type="search"
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-help`}
              aria-autocomplete="list"
              aria-controls={`${id}-results`}
              placeholder={`Search your shop's address or area${city ? ` in ${city.name}` : ""}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul className="location-results" id={`${id}-results`} role="listbox" aria-label="Matching addresses">
                {results.map((p) => (
                  <li key={`${p.lat},${p.lng}`} role="option" aria-selected={false}>
                    <button type="button" onClick={() => choose(p)}>
                      {p.address}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="location-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={useHere} disabled={busy === "here"}>
              {busy === "here" ? "Finding you…" : "Use my current location"}
            </button>
            <button type="button" className="link-btn" onClick={() => setLinkMode((v) => !v)} aria-expanded={linkMode}>
              Paste a Google Maps link
            </button>
          </div>
          {linkMode && (
            <div className="location-link">
              <input className="input" type="url" placeholder="https://maps.app.goo.gl/…" aria-label="Google Maps link" value={link} onChange={(e) => setLink(e.target.value)} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={useLink} disabled={busy === "link" || !link.trim()}>
                {busy === "link" ? "Reading…" : "Use this link"}
              </button>
            </div>
          )}
          <p className="field-hint" id={`${id}-help`} role="status">
            {busy === "search" ? "Searching…" : "Customers see how far you are and get directions to you."}
          </p>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
