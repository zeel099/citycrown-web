import { formatMoney } from "@/lib/money";

/** "Widen the lead" for the current #1, minor units; never below the board's minimum bid. */
export const WIDEN_LEAD = 10000;

export const PAYMENT_FAILED = "The payment didn't go through, so the board hasn't changed. Try again or use another method.";

export type BidOutcome = { status: "CONFIRMED" | "FAILED" | "PENDING"; message: string };

/** Polls until the webhook has confirmed (or failed) the bid. */
export async function pollBid(bidId: string): Promise<BidOutcome> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`/api/bids/${bidId}`, { cache: "no-store" });
    if (res.ok) {
      const s = await res.json();
      if (s.status === "CONFIRMED") {
        const where = s.rank ? `is now #${s.rank}` : "has a new total";
        return { status: "CONFIRMED", message: `Bid of ${formatMoney(s.amount, s.currency)} confirmed. ${s.listingName} ${where}.` };
      }
      if (s.status === "FAILED") return { status: "FAILED", message: PAYMENT_FAILED };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { status: "PENDING", message: "We're still waiting for the payment to confirm. The board will update once it does." };
}
