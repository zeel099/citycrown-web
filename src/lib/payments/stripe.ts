import Stripe from "stripe";
import { requireEnv } from "../env";
import type { PaymentProvider } from "./types";

let client: Stripe | undefined;
export function stripeClient() {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return client;
}

export const stripeProvider: PaymentProvider = {
  gateway: "STRIPE",
  async createCheckout(req) {
    const appUrl = requireEnv("APP_URL");
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      customer_email: req.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: req.amount,
            product_data: { name: req.description },
          },
        },
      ],
      metadata: { bidId: req.bidId },
      payment_intent_data: { metadata: { bidId: req.bidId } },
      success_url: `${appUrl}${req.returnPath}${req.returnPath.includes("?") ? "&" : "?"}bid=${req.bidId}`,
      cancel_url: `${appUrl}${req.returnPath}`,
    });
    return { gatewayRef: session.id, checkout: { kind: "redirect", url: session.url! } };
  },
};
