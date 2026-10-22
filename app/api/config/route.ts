import { aiEnabled, config, paypalEnabled } from "@/lib/config";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({
    paypal: {
      mode: paypalEnabled() ? "sandbox" : "simulated",
      clientId: config.paypal.clientId || null,
      // Sandbox test-money login for judges, only when both values are set.
      demoBuyer: paypalEnabled() && config.paypal.demoBuyerEmail && config.paypal.demoBuyerPassword ? { email: config.paypal.demoBuyerEmail, password: config.paypal.demoBuyerPassword } : null,
    },
    ai: { mode: aiEnabled() ? "gemini" : "simulated", model: aiEnabled() ? config.ai.model : null },
    currency: config.currency,
  });
}
