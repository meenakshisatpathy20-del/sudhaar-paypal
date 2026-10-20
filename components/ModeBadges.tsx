"use client";

import { useAppConfig } from "./useAppConfig";

export function ModeBadges() {
  const cfg = useAppConfig();
  if (!cfg) return null;
  return (
    <div className="flex gap-1.5 text-[11px]">
      <span
        className={`pill ${cfg.paypal.mode === "sandbox" ? "bg-[#e8f0fe] text-[#003087]" : "bg-amber-100 text-amber-800"}`}
        title={cfg.paypal.mode === "sandbox" ? "Live calls to the PayPal sandbox" : "No PayPal credentials configured: PayPal calls are simulated"}
      >
        PayPal {cfg.paypal.mode === "sandbox" ? "Sandbox" : "Simulated"}
      </span>
      <span
        className={`pill ${cfg.ai.mode === "claude" ? "bg-brand-light text-brand-dark" : "bg-amber-100 text-amber-800"}`}
        title={cfg.ai.mode === "claude" ? `AI: ${cfg.ai.model}` : "No AI key configured: AI is simulated"}
      >
        AI {cfg.ai.mode === "claude" ? "Claude" : "Simulated"}
      </span>
    </div>
  );
}
