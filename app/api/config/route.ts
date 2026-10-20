import { aiEnabled, config, paypalEnabled } from "@/lib/config";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({
    paypal: { mode: paypalEnabled() ? "sandbox" : "simulated", clientId: config.paypal.clientId || null },
    ai: { mode: aiEnabled() ? "claude" : "simulated", model: aiEnabled() ? config.ai.model : null },
    currency: config.currency,
  });
}
