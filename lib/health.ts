import { aiConfigured, config, paypalConfigured, serviceProblems } from "./config";
import { gemini } from "./llm";
import { verifyPayPalKeys } from "./paypal";

// Checks that PayPal and Gemini accept our keys: at server start (instrumentation.ts) and from the
// admin System check. A rejected key switches that service to labelled simulation, with the reason
// and the fix shown to the admin, so a wrong dashboard setting can't break every booking.

export type ServiceStatus = { state: "live" | "simulated" | "problem"; detail: string; fix?: string };
export type HealthReport = { paypal: ServiceStatus; gemini: ServiceStatus; checkedAt: string };

let last: HealthReport | null = null;

async function checkPayPal(): Promise<ServiceStatus> {
  delete serviceProblems.paypal;
  if (!paypalConfigured()) return { state: "simulated", detail: "No PayPal keys are set, so payments are simulated.", fix: "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox) on the server." };
  const r = await verifyPayPalKeys();
  if (r.ok) return { state: "live", detail: "PayPal sandbox accepted the Client ID and Secret." };
  if (r.status === 401 || /client authentication/i.test(r.message)) {
    serviceProblems.paypal = "PayPal rejected the Client ID / Secret";
    return {
      state: "problem",
      detail: `PayPal rejected the keys (${r.message}). Payments are simulated until this is fixed.`,
      fix: "In developer.paypal.com > Apps & Credentials, choose Sandbox, open your app and copy its Client ID and Secret into PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server. Both must come from the same sandbox app, and a regenerated Secret replaces the old one.",
    };
  }
  // A network hiccup isn't a bad key: keep PayPal on and report it.
  return { state: "problem", detail: `Couldn't reach PayPal just now (${r.message}). Bookings will try PayPal again.`, fix: "Run the check again in a minute." };
}

async function checkGemini(): Promise<ServiceStatus> {
  delete serviceProblems.ai;
  if (!aiConfigured()) return { state: "simulated", detail: "No Gemini key is set, so AI quotes are simulated and the Talk assistant is off.", fix: "Set GEMINI_API_KEY on the server (free key from aistudio.google.com)." };
  try {
    await gemini().models.get({ model: config.ai.model });
    return { state: "live", detail: `Google accepted the key; model ${config.ai.model} is available.` };
  } catch (e) {
    const status = (e as { status?: number }).status;
    const message = String((e as Error).message ?? e);
    if (status === 400 || status === 401 || status === 403 || /API key|PERMISSION_DENIED|API_KEY_INVALID/i.test(message)) {
      serviceProblems.ai = "Google rejected the Gemini API key";
      return {
        state: "problem",
        detail: "Google rejected the Gemini API key. AI quotes are simulated and the Talk assistant is off until this is fixed.",
        fix: "In aistudio.google.com > API keys, copy a working key into GEMINI_API_KEY on the server (no quotes or spaces).",
      };
    }
    if (status === 404) return { state: "problem", detail: `Model ${config.ai.model} isn't available for this key.`, fix: "Remove AI_MODEL on the server to use the default, or set it to a model listed in AI Studio." };
    return { state: "problem", detail: `Couldn't reach Gemini just now (${message.slice(0, 160)}). Requests will still try Gemini.`, fix: "Run the check again in a minute." };
  }
}

export async function checkServices(): Promise<HealthReport> {
  const [paypal, geminiStatus] = await Promise.all([checkPayPal(), checkGemini()]);
  last = { paypal, gemini: geminiStatus, checkedAt: new Date().toISOString() };
  for (const [name, s] of [["PayPal", paypal], ["Gemini", geminiStatus]] as const) {
    if (s.state === "problem") console.warn(`[health] ${name}: ${s.detail}`);
    else console.log(`[health] ${name}: ${s.detail}`);
  }
  return last;
}

export const lastHealth = () => last;
