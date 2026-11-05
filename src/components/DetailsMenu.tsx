"use client";

import { useEffect, useRef } from "react";

/**
 * A <details> dropdown that also closes when you click or tap anywhere outside it, press Escape,
 * or tab out of it (on its own, <details> only closes from its own summary).
 */
export function DetailsMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const outside = (target: EventTarget | null) => target instanceof Node && !menu.contains(target);
    const onPointerDown = (e: PointerEvent) => {
      if (menu.open && outside(e.target)) menu.open = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !menu.open) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (menu.open && outside(e.relatedTarget)) menu.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    menu.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      menu.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
