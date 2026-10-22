import { aiEnabled, config, paypalEnabled, serviceProblems } from "@/lib/config";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({
    // `problem` is a short, secret-free reason when a key was rejected (details in the admin System check).
    paypal: { mode: paypalEnabled() ? "sandbox" : "simulated", clientId: paypalEnabled() ? config.paypal.clientId : null, problem: serviceProblems.paypal ?? null },
    ai: { mode: aiEnabled() ? "gemini" : "simulated", model: aiEnabled() ? config.ai.model : null, problem: serviceProblems.ai ?? null },
    currency: config.currency,
  });
}
