"use client";

import { useState } from "react";
import type { Checkout } from "@/lib/payments/types";
import { PAYMENT_FAILED, pollBid, type BidOutcome } from "./bid-client";

type RazorpayCheckout = { open(): void; on?(event: "payment.failed", cb: () => void): void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

/**
 * Creates the bid, then runs the gateway's checkout (mock, Razorpay or a Stripe
 * redirect) and waits for the webhook. Rank changes only after confirmation (BR-06).
 */
export function useCheckout(onDone: (msg: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish(outcome: BidOutcome) {
    if (outcome.status === "FAILED") {
      setError(outcome.message);
      setBusy(false);
    } else {
      onDone(outcome.message);
    }
  }

  async function pay(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bids", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const checkout = data.checkout as Checkout;

      if (checkout.kind === "redirect") {
        window.location.href = checkout.url;
        return;
      }
      if (checkout.kind === "mock") {
        await fetch(checkout.confirmUrl, { method: "POST" });
        finish(await pollBid(data.bidId));
        return;
      }
      await loadRazorpay();
      const rz = new window.Razorpay!({
        key: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "Best in the City",
        description: checkout.description,
        prefill: { email: checkout.email },
        handler: async () => finish(await pollBid(data.bidId)),
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on?.("payment.failed", () => setError(PAYMENT_FAILED));
      rz.open();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return { busy, error, pay };
}
