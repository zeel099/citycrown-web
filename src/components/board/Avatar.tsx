"use client";

import { useState } from "react";
import type { Avatar as AvatarData } from "@/lib/board-view";

/** The business's saved picture, or a letter tile when it has none (or it fails to load). */
export function Avatar({ avatar, size = "md" }: { avatar: AvatarData; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  if (avatar.image && !failed) {
    return <img className={`avatar avatar-${size} avatar-img`} src={avatar.image} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <span className={`avatar avatar-${size}`} style={{ background: avatar.color }} aria-hidden="true">
      {avatar.letter}
    </span>
  );
}
