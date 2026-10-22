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
    // PAYPAL_API_BASE is only for tests against a local stand-in server.
    apiBase: env("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com",
    webhookId: env("PAYPAL_WEBHOOK_ID"),
    karigarPayoutEmail: env("PAYPAL_KARIGAR_EMAIL") || "karigar@example.com",
    saathiPayoutEmail: env("PAYPAL_SAATHI_EMAIL") || "saathi@example.com",
    customerEmail: env("PAYPAL_CUSTOMER_EMAIL") || "customer@example.com",
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

/**
 * Set when PayPal or Google rejects our keys (see lib/health.ts). The app then runs in clearly
 * labelled simulation instead of failing every request, and the admin System check says why.
 * Kept on globalThis because Next.js can load this module more than once in one server.
 */
type Problems = { paypal?: string; ai?: string };
const g = globalThis as typeof globalThis & { __sudhaarProblems?: Problems };
export const serviceProblems: Problems = (g.__sudhaarProblems ??= {});

export const paypalConfigured = () => Boolean(config.paypal.clientId && config.paypal.clientSecret);
export const aiConfigured = () => Boolean(config.ai.apiKey);
export const paypalEnabled = () => paypalConfigured() && !serviceProblems.paypal;
export const aiEnabled = () => aiConfigured() && !serviceProblems.ai;
