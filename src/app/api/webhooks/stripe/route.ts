import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { confirmPayment, failPayment, reversePayment } from "@/lib/bids";
import { requireEnv } from "@/lib/env";
import { stripeClient } from "@/lib/payments/stripe";

const intentId = (v: string | Stripe.PaymentIntent | null) => (typeof v === "string" ? v : v?.id ?? null);

export async function POST(req: Request) {
  const raw = await req.text();
  let evt: Stripe.Event;
  try {
    evt = stripeClient().webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  switch (evt.type) {
    case "checkout.session.completed": {
      const session = evt.data.object;
      if (session.payment_status === "paid") {
        const result = await confirmPayment({
          gateway: "STRIPE",
          gatewayRef: session.id,
          gatewayPaymentId: intentId(session.payment_intent),
          amount: session.amount_total ?? 0,
        });
        return NextResponse.json({ result });
      }
      break;
    }
    case "checkout.session.expired":
      await failPayment("STRIPE", evt.data.object.id);
      break;
    case "charge.refunded": {
      const id = intentId(evt.data.object.payment_intent);
      if (id) await reversePayment("STRIPE", id, "refund");
      break;
    }
    case "charge.dispute.created": {
      const id = intentId(evt.data.object.payment_intent);
      if (id) await reversePayment("STRIPE", id, "chargeback");
      break;
    }
  }
  return NextResponse.json({ received: true });
}
