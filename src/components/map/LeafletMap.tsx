"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker } from "leaflet";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo";

// OpenStreetMap tiles by default; for heavy traffic point NEXT_PUBLIC_MAP_TILES at a tile provider.
const TILES = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type Props = {
  center: LatLng;
  marker?: LatLng | null;
  zoom?: number;
  draggable?: boolean; // the owner can drag the pin to the exact spot
  onMove?: (to: LatLng) => void;
  label: string; // what the map shows, for screen readers
  className?: string;
};

/** An OpenStreetMap map with one pin. Leaflet is loaded in the browser only. */
export function LeafletMap({ center, marker, zoom = 16, draggable = false, onMove, label, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
      map.current = m;
      if (marker) {
        const icon = L.divIcon({ className: "map-pin", html: "<span></span>", iconSize: [28, 36], iconAnchor: [14, 34] });
        const p = L.marker([marker.lat, marker.lng], { icon, draggable, keyboard: draggable, title: label }).addTo(m);
        p.on("dragend", () => {
          const at = p.getLatLng();
          onMoveRef.current?.({ lat: at.lat, lng: at.lng });
        });
        pin.current = p;
      }
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
    // The map is built once; later pin changes are applied by the effect below.
  }, []);

  useEffect(() => {
    if (marker && pin.current) {
      const at = pin.current.getLatLng();
      if (Math.abs(at.lat - marker.lat) > 1e-7 || Math.abs(at.lng - marker.lng) > 1e-7) {
        pin.current.setLatLng([marker.lat, marker.lng]);
        map.current?.setView([marker.lat, marker.lng], Math.max(map.current.getZoom(), zoom));
      }
    }
  }, [marker, zoom]);

  return <div ref={el} className={`leaflet-host ${className ?? ""}`} role={draggable ? "application" : "img"} aria-label={label} />;
}
