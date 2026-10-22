// Central place for environment configuration. Everything is server-side only;
// the browser gets what it needs (PayPal client id, modes) from /api/config.

function num(v: string | undefined, fallback: number) {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Env values with stray spaces or line breaks (easy to paste into a dashboard) removed. */
const env = (name: string) => (process.env[name] ?? "").trim();

export const config = {
  paypal: {
    clientId: env("PAYPAL_CLIENT_ID"),
    clientSecret: env("PAYPAL_CLIENT_SECRET"),
    // Sudhaar only ever talks to the PayPal sandbox.
    apiBase: "https://api-m.sandbox.paypal.com",
    webhookId: env("PAYPAL_WEBHOOK_ID"),
    karigarPayoutEmail: env("PAYPAL_KARIGAR_EMAIL") || "karigar@example.com",
    saathiPayoutEmail: env("PAYPAL_SAATHI_EMAIL") || "saathi@example.com",
    customerEmail: env("PAYPAL_CUSTOMER_EMAIL") || "customer@example.com",
    // Optional: a sandbox *buyer* login shown under the PayPal button so judges can test payments.
    // Sandbox accounts only hold PayPal's test money; never put real credentials here.
    demoBuyerEmail: env("PAYPAL_DEMO_BUYER_EMAIL"),
    demoBuyerPassword: env("PAYPAL_DEMO_BUYER_PASSWORD"),
  },
  ai: {
    // Google Gemini (aistudio.google.com). "gemini-flash-latest" follows Google's current Flash model.
    apiKey: env("GEMINI_API_KEY"),
    model: env("AI_MODEL") || "gemini-flash-latest",
    /** Used when the main model is overloaded (Google's "high demand" 503). */
    fallbackModel: env("AI_FALLBACK_MODEL") || "gemini-flash-lite-latest",
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
