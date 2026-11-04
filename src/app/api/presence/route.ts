import { NextResponse } from "next/server";
import { liveCounts, recordVisit } from "@/lib/visits";

/** Open pages check in here (components/LiveStats) and get the header's live counts back. */
export async function POST(req: Request) {
  // Only our own pages count as a visit, not other sites posting here.
  const site = req.headers.get("sec-fetch-site");
  if (!site || site === "same-origin") await recordVisit(req);
  return NextResponse.json(await liveCounts(), { headers: { "Cache-Control": "no-store" } });
}
