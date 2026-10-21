"use client";

import { Badge } from "@/components/ui/badge";
import { useAppConfig } from "./useAppConfig";

/** Shows whether the server talks to the real PayPal sandbox / Claude, or simulates them. */
export function ModeBadges({ compact = false }: { compact?: boolean }) {
  const cfg = useAppConfig();
  if (!cfg) return null;
  const pp = cfg.paypal.mode === "sandbox";
  const ai = cfg.ai.mode === "claude";
  return (
    <div className="flex gap-1.5">
      <Badge variant={pp ? "paypal" : "gold"} title={pp ? "Live calls to the PayPal sandbox" : "No PayPal keys: PayPal calls are simulated"}>
        {compact ? "PayPal" : pp ? "PayPal Sandbox" : "PayPal Simulated"}
        {compact && <span className={`size-1.5 rounded-full ${pp ? "bg-[#0050b3]" : "bg-gold"}`} />}
      </Badge>
      <Badge variant={ai ? "default" : "gold"} title={ai ? `AI: ${cfg.ai.model}` : "No AI key: AI is simulated"}>
        {compact ? "AI" : ai ? "AI Claude" : "AI Simulated"}
        {compact && <span className={`size-1.5 rounded-full ${ai ? "bg-primary" : "bg-gold"}`} />}
      </Badge>
    </div>
  );
}
