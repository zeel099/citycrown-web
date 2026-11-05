import { NextResponse } from "next/server";
import { confirmPayment } from "@/lib/bids";
import { db } from "@/lib/db";
import { mockPaymentsEnabled } from "@/lib/payments/mock";

/** Development stand-in for a gateway webhook. Disabled unless PAYMENT_PROVIDER=mock outside production. */
export async function POST(req: Request) {
  if (!mockPaymentsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bidId = new URL(req.url).searchParams.get("bid") ?? "";
  const bid = await db.bid.findUnique({ where: { id: bidId } });
  if (!bid) return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  const result = await confirmPayment({ gateway: "MOCK", gatewayRef: `mock_${bid.id}`, gatewayPaymentId: `mockpay_${bid.id}`, amount: bid.amount });
  return NextResponse.json({ result });
}
