// Central place for environment configuration. Everything is server-side only;
// the browser gets what it needs (PayPal client id, modes) from /api/config.

function num(v: string | undefined, fallback: number) {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    // Sudhaar only ever talks to the PayPal sandbox.
    apiBase: "https://api-m.sandbox.paypal.com",
    webhookId: process.env.PAYPAL_WEBHOOK_ID ?? "",
    karigarPayoutEmail: process.env.PAYPAL_KARIGAR_EMAIL ?? "karigar@example.com",
    saathiPayoutEmail: process.env.PAYPAL_SAATHI_EMAIL ?? "saathi@example.com",
    customerEmail: process.env.PAYPAL_CUSTOMER_EMAIL ?? "customer@example.com",
  },
  ai: {
    // Google Gemini (aistudio.google.com). "gemini-flash-latest" follows Google's current Flash model.
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.AI_MODEL || "gemini-flash-latest",
  },
  demoCenter: {
    lat: num(process.env.DEMO_CENTER_LAT, 12.9716),
    lng: num(process.env.DEMO_CENTER_LNG, 77.5946),
  },
  dataDir: process.env.DATA_DIR ?? "./data",
  currency: "USD" as const,
};

export const paypalEnabled = () => Boolean(config.paypal.clientId && config.paypal.clientSecret);
export const aiEnabled = () => Boolean(config.ai.apiKey);
