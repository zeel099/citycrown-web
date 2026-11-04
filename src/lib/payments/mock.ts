import type { PaymentProvider } from "./types";

/** Development only: the browser confirms the payment itself through /api/dev/mock-pay. */
export const mockProvider: PaymentProvider = {
  gateway: "MOCK",
  async createCheckout(req) {
    return { gatewayRef: `mock_${req.bidId}`, checkout: { kind: "mock", confirmUrl: `/api/dev/mock-pay?bid=${req.bidId}` } };
  },
};

export const mockPaymentsEnabled = () =>
  process.env.PAYMENT_PROVIDER === "mock" && process.env.NODE_ENV !== "production";
