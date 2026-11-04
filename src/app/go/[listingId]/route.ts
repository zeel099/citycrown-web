import { NextResponse } from "next/server";
import type { EventType } from "@prisma/client";
import { db } from "@/lib/db";
import { isBot, sessionHash } from "@/lib/events";

const TARGETS = {
  website: { field: "websiteUrl", event: "CLICK_WEBSITE" },
  instagram: { field: "instagramUrl", event: "CLICK_INSTAGRAM" },
  facebook: { field: "facebookUrl", event: "CLICK_FACEBOOK" },
} as const satisfies Record<string, { field: string; event: EventType }>;

/** Outbound links go through here so clicks are counted per listing (FR-ANL-01). */
export async function GET(req: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const to = new URL(req.url).searchParams.get("to") as keyof typeof TARGETS | null;
  const target = to && TARGETS[to];
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  const url = target && listing?.status === "LIVE" ? listing[target.field] : null;
  if (!target || !url) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  if (!isBot(req)) {
    await db.event.create({ data: { listingId, type: target.event, sessionHash: sessionHash(req) } });
  }
  return NextResponse.redirect(url, 302);
}
