"use client";

import { useEffect, useState } from "react";

export type AppConfig = {
  paypal: { mode: "sandbox" | "simulated"; clientId: string | null; demoBuyer?: { email: string; password: string } | null };
  ai: { mode: "gemini" | "simulated"; model: string | null };
  currency: string;
};

let cached: Promise<AppConfig> | null = null;

export function useAppConfig() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  useEffect(() => {
    cached ??= fetch("/api/config").then((r) => r.json());
    cached.then(setCfg).catch(() => setCfg(null));
  }, []);
  return cfg;
}
