import { NextResponse } from "next/server";
import { bidStatus } from "@/lib/bids";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const status = await bidStatus((await params).id);
  if (!status) return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  return NextResponse.json(status);
}
