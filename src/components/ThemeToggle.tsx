"use client";

import { useEffect, useState } from "react";

const DARK = "(prefers-color-scheme: dark)";

function isDark() {
  const saved = document.documentElement.dataset.theme;
  return saved ? saved === "dark" : window.matchMedia(DARK).matches;
}

/** Moon / sun button. Follows the device setting until pressed, then remembers the choice in this browser (see lib/theme). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark());
    const media = window.matchMedia(DARK);
    const onChange = () => setDark(isDark());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage blocked (private mode): the choice lasts until the page is closed.
    }
    setDark(!dark);
  }

  return (
    <button type="button" className="icon-btn" aria-pressed={dark} aria-label="Dark mode" onClick={toggle}>
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
