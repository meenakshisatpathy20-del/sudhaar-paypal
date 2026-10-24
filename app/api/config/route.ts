import { aiEnabled, config, paypalEnabled, serviceProblems } from "@/lib/config";
import { ok } from "@/lib/http";
import { bolnaConfig, callbackEnabled } from "@/lib/bolna";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({
    // `problem` is a short, secret-free reason when a key was rejected (details in the admin System check).
    paypal: {
      mode: paypalEnabled() ? "sandbox" : "simulated",
      clientId: paypalEnabled() ? config.paypal.clientId : null,
      problem: serviceProblems.paypal ?? null,
      // Sandbox test-money login for judges, only when both values are set.
      demoBuyer: paypalEnabled() && config.paypal.demoBuyerEmail && config.paypal.demoBuyerPassword ? { email: config.paypal.demoBuyerEmail, password: config.paypal.demoBuyerPassword } : null,
    },
    ai: { mode: aiEnabled() ? "gemini" : "simulated", model: aiEnabled() ? config.ai.model : null, problem: serviceProblems.ai ?? null },
    currency: config.currency,
    // The Bolna phone line: the number to dial (if set) and whether "Call me" works.
    voice: { phoneNumber: bolnaConfig().phoneNumber || null, callback: callbackEnabled() },
  });
}
