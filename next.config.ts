import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Razorpay and Stripe SDKs are Node-only; keep them out of the client bundle.
  serverExternalPackages: ["razorpay", "stripe"],
};

export default nextConfig;
