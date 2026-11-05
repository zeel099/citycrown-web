"use client";

import { useEffect, useRef } from "react";

/** The category bar. On narrow screens it scrolls sideways, so it starts with the current category in the middle. */
export function CategoryNav({ current, children }: { current: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollLeft += offset - (nav.clientWidth - active.offsetWidth) / 2;
  }, [current]);

  return (
    <nav ref={ref} className="category-nav" aria-label="Categories">
      {children}
    </nav>
  );
}
