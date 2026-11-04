import type { Gateway } from "@prisma/client";

export type CheckoutRequest = {
  bidId: string;
  amount: number; // minor units
  currency: string;
  email: string;
  description: string; // e.g. "Bid on Brew Lane · Surat → Cafes"
  returnPath: string; // board path to send the bidder back to
};

/** What the browser needs to collect payment. */
export type Checkout =
  | { kind: "razorpay"; keyId: string; orderId: string; amount: number; currency: string; description: string; email: string }
  | { kind: "redirect"; url: string }
  | { kind: "mock"; confirmUrl: string };

export interface PaymentProvider {
  gateway: Gateway;
  /** Creates the order or session; gatewayRef is what the webhook will quote back. */
  createCheckout(req: CheckoutRequest): Promise<{ gatewayRef: string; checkout: Checkout }>;
}
