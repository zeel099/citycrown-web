"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiveCounts } from "@/lib/visits";

const PING_MS = 30_000; // lib/visits counts a visitor as online for 75 seconds after a check-in

/** "● 20 online · 2,849 visitors today · stats→". Checks in while the page is open, which also counts the visit. */
export function LiveStats({ initial }: { initial: LiveCounts }) {
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    let stopped = false;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence", { method: "POST" })
        .then((res) => (res.ok ? res.json() : null))
        .then((next: LiveCounts | null) => !stopped && next && setCounts(next))
        .catch(() => {});
    };
    ping();
    const timer = setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return (
    <Link className="ticker" href="/about#stats">
      <span className="ticker-dot" aria-hidden="true" />
      <b>{counts.online.toLocaleString("en-IN")} online</b>
      <span>· {counts.today.toLocaleString("en-IN")} visitors today ·</span>
      <span className="ticker-more">
        stats<span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
