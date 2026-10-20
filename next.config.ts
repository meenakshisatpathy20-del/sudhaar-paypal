import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PayPal Agent Toolkit pulls in large server-only dependencies; load it from node_modules at runtime.
  serverExternalPackages: ["@paypal/agent-toolkit"],
};

export default nextConfig;
