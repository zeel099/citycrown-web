import crypto from "node:crypto";
import Razorpay from "razorpay";
import { requireEnv } from "../env";
import type { PaymentProvider } from "./types";

export const razorpayProvider: PaymentProvider = {
  gateway: "RAZORPAY",
  async createCheckout(req) {
    const client = new Razorpay({ key_id: requireEnv("RAZORPAY_KEY_ID"), key_secret: requireEnv("RAZORPAY_KEY_SECRET") });
    const order = await client.orders.create({
      amount: req.amount,
      currency: req.currency,
      receipt: req.bidId,
      notes: { bidId: req.bidId },
    });
    return {
      gatewayRef: order.id,
      checkout: {
        kind: "razorpay",
        keyId: requireEnv("RAZORPAY_KEY_ID"),
        orderId: order.id,
        amount: req.amount,
        currency: req.currency,
        description: req.description,
        email: req.email,
      },
    };
  },
};

/** X-Razorpay-Signature is an HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpaySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
