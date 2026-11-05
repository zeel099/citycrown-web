"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

function remaining(ms: number) {
  const days = Math.floor(ms / 864e5);
  const clock = `${pad(Math.floor((ms % 864e5) / 36e5))}:${pad(Math.floor((ms % 36e5) / 6e4))}:${pad(Math.floor((ms % 6e4) / 1e3))}`;
  return `${days ? `${days}d ` : ""}${clock} left`;
}

/** "23:38:41 left" until the period resets; refreshes the board once it does (FR-PER-02). */
export function Countdown({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const rem = Math.max(0, new Date(endsAt).getTime() - now);
  const ended = rem === 0;
  useEffect(() => {
    if (ended) router.refresh();
  }, [ended, router]);
  return (
    <span className="countdown" role="timer" suppressHydrationWarning>
      {remaining(rem)}
    </span>
  );
}
