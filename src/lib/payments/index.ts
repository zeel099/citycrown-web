import { mockPaymentsEnabled, mockProvider } from "./mock";
import { razorpayProvider } from "./razorpay";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/** FR-PAY-01: Razorpay for INR (UPI and Indian methods), Stripe for everything else. */
export function providerFor(currency: string): PaymentProvider {
  const choice = process.env.PAYMENT_PROVIDER ?? "auto";
  if (choice === "mock") {
    if (!mockPaymentsEnabled()) throw new Error("Mock payments are disabled in production");
    return mockProvider;
  }
  if (choice === "razorpay") return razorpayProvider;
  if (choice === "stripe") return stripeProvider;
  return currency === "INR" ? razorpayProvider : stripeProvider;
}

export type { Checkout } from "./types";
