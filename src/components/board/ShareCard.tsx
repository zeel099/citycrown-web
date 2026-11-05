"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardRow } from "@/lib/board-view";
import { formatMoney } from "@/lib/money";
import { Avatar } from "./Avatar";
import { storyImage } from "./story-image";

type Props = {
  id: string;
  path: string; // board path including the period, e.g. /surat/cafes?period=today
  boardName: string; // "Surat · Cafes"
  when: string; // "" or "today's "
  rows: BoardRow[];
  currency: string;
  onClose: () => void;
};

/** FR-BRD-08: share a board on WhatsApp, as an Instagram story image, or by link. */
export function ShareCard({ id, path, boardName, when, rows, currency, onClose }: Props) {
  const [status, setStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const url = `${window.location.origin}${path}`;
  const shownUrl = url.replace(/^https?:\/\/(www\.)?/, "");
  const ranked = rows.filter((r) => r.rank !== null);
  const top = ranked[0];
  const headline = top ? `${top.name} is ${when}#1 in ${boardName}` : `Who will be ${when}#1 in ${boardName}?`;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest("section")?.scrollIntoView({ block: "nearest" });
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Couldn't copy. Select the link below and copy it.");
    }
  }

  async function story() {
    setStatus("Making the image…");
    try {
      const blob = await storyImage({
        boardName,
        headline,
        rows: ranked.slice(0, 5).map((r) => ({ rank: r.rank!, name: r.name, total: formatMoney(r.total, currency) })),
        url: shownUrl,
      });
      const file = new File([blob], `${path.split("?")[0].slice(1).replace(/\//g, "-")}-story.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: headline });
        setStatus("");
        return;
      }
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href, download: file.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setStatus("Image saved. Add it to your Instagram story.");
    } catch (err) {
      setStatus(err instanceof DOMException && err.name === "AbortError" ? "" : "Couldn't make the image. Try again.");
    }
  }

  return (
    <section className="share card" id={id} aria-labelledby={`${id}-title`}>
      <div className="share-head">
        <h2 className="share-title" id={`${id}-title`} ref={heading} tabIndex={-1}>
          Share this board
        </h2>
        <button type="button" className="link-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="share-preview">
        {top && <Avatar avatar={top.avatar} size="sm" />}
        <div>
          <p className="share-headline">{headline}</p>
          <p className="share-sub">{top ? `${formatMoney(top.total, currency)} · Sponsored ranking` : "No bids yet"}</p>
        </div>
      </div>
      <div className="share-actions">
        <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`${headline}. ${url}`)}`} target="_blank" rel="noopener">
          WhatsApp
        </a>
        <button type="button" className="btn btn-secondary btn-sm" onClick={story}>
          Instagram story
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          Copy link
        </button>
      </div>
      <p className="share-url">{shownUrl}</p>
      <p className="share-status" role="status">
        {status}
      </p>
    </section>
  );
}
