import { NextResponse } from "next/server";
import { confirmPayment, failPayment, reversePayment } from "@/lib/bids";
import { requireEnv } from "@/lib/env";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";

type RazorpayEvent = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number } };
    refund?: { entity: { payment_id: string } };
    dispute?: { entity: { payment_id: string } };
  };
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyRazorpaySignature(raw, req.headers.get("x-razorpay-signature"), requireEnv("RAZORPAY_WEBHOOK_SECRET"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const evt = JSON.parse(raw) as RazorpayEvent;
  const payment = evt.payload.payment?.entity;

  switch (evt.event) {
    case "payment.captured":
    case "order.paid":
      if (payment) {
        const result = await confirmPayment({
          gateway: "RAZORPAY",
          gatewayRef: payment.order_id,
          gatewayPaymentId: payment.id,
          amount: payment.amount,
        });
        return NextResponse.json({ result });
      }
      break;
    case "payment.failed":
      if (payment) await failPayment("RAZORPAY", payment.order_id);
      break;
    case "refund.processed":
      if (evt.payload.refund) await reversePayment("RAZORPAY", evt.payload.refund.entity.payment_id, "refund");
      break;
    case "payment.dispute.created":
      if (evt.payload.dispute) await reversePayment("RAZORPAY", evt.payload.dispute.entity.payment_id, "chargeback");
      break;
  }
  return NextResponse.json({ received: true });
}
