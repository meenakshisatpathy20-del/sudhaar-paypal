"use client";

import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { api } from "./api";
import { useLang } from "./LanguageProvider";
import { useSession } from "./SessionProvider";
import { Button } from "./ui/button";
import { useAppConfig } from "./useAppConfig";
import { cn } from "@/lib/utils";

/**
 * The Bolna phone line: a number to call in Hindi (for people without a smartphone) and "Call me".
 * Shows nothing until the server has a phone number or Bolna call-back configured.
 */
export function PhoneLine({ className }: { className?: string }) {
  const { t } = useLang();
  const cfg = useAppConfig();
  const { account } = useSession();
  const [state, setState] = useState<"idle" | "busy" | "calling">("idle");
  const [error, setError] = useState<string | null>(null);
  const voice = cfg?.voice;
  if (!voice || (!voice.phoneNumber && !voice.callback)) return null;
  const canCallMe = voice.callback && account?.role === "customer";
  return (
    <div className={cn("flex flex-wrap items-center gap-4 rounded-2xl bg-teal/10 p-4 ring-1 ring-teal/25", className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal text-white">
        <PhoneCall className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("plTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("plSub")}</p>
        {voice.phoneNumber && (
          <a href={`tel:${voice.phoneNumber.replace(/\s/g, "")}`} className="mt-1 inline-block font-display text-xl font-bold text-teal">
            {voice.phoneNumber}
          </a>
        )}
      </div>
      {canCallMe && (
        <div className="space-y-1">
          <Button
            variant="outline"
            disabled={state !== "idle"}
            onClick={async () => {
              setState("busy");
              setError(null);
              try {
                await api("/api/voice/callback", {});
                setState("calling");
              } catch (e) {
                setError((e as Error).message);
                setState("idle");
              }
            }}
          >
            <PhoneCall /> {state === "calling" ? t("plCalling") : t("plCallMe")}
          </Button>
          {error && <p className="max-w-56 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
