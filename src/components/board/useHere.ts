"use client";

import { useEffect, useState } from "react";
import { isValidLatLng, type LatLng } from "@/lib/geo";

// The visitor's location, for distances on the board. It never leaves the browser:
// distances are worked out here, and it's kept for this browser session only.

const KEY = "bitc:here";

type State = { here: LatLng | null; status: "off" | "asking" | "on" | "denied" | "unavailable" };

export function useHere() {
  const [state, setState] = useState<State>({ here: null, status: "off" });

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      if (isValidLatLng(saved)) setState({ here: saved, status: "on" });
    } catch {
      // storage blocked (private mode): ask again when needed
    }
  }, []);

  function ask() {
    if (!("geolocation" in navigator)) return setState({ here: null, status: "unavailable" });
    setState((s) => ({ ...s, status: "asking" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          sessionStorage.setItem(KEY, JSON.stringify(here));
        } catch {
          // fine: distances still show on this page
        }
        setState({ here, status: "on" });
      },
      (err) => setState({ here: null, status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  }

  function stop() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
    setState({ here: null, status: "off" });
  }

  return { ...state, ask, stop };
}
