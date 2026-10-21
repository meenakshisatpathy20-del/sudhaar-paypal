"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "./LanguageProvider";
import { speechSupported, startListening } from "./voice";

/** Mic button: speech-to-text in the selected language (hi-IN / en-IN). */
export function MicButton({ onText, onFinal, className, size = "md" }: { onText: (t: string) => void; onFinal?: (t: string) => void; className?: string; size?: "md" | "lg" }) {
  const { lang, t } = useLang();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const stopRef = useRef<() => void>(() => {});
  const lastText = useRef("");

  useEffect(() => {
    setSupported(speechSupported());
  }, []);

  function toggle() {
    if (listening) {
      stopRef.current();
      return;
    }
    setError(null);
    lastText.current = "";
    setListening(true);
    stopRef.current = startListening(
      lang,
      (text, final) => {
        lastText.current = text;
        onText(text);
        if (final) onFinal?.(text);
      },
      () => setListening(false),
      (msg) => {
        setError(msg);
        setListening(false);
      },
    );
  }

  if (!supported) return null;
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? t("listening") : t("speak")}
        className={cn(
          "relative grid place-items-center rounded-full transition",
          size === "lg" ? "size-20" : "size-11",
          listening ? "bg-destructive text-white" : "bg-primary text-primary-foreground hover:scale-105",
        )}
      >
        {listening && <span className="absolute inset-0 rounded-full bg-destructive/60" style={{ animation: "ping-soft 1.2s ease-out infinite" }} />}
        {listening ? <MicOff className={size === "lg" ? "size-8" : "size-5"} /> : <Mic className={size === "lg" ? "size-8" : "size-5"} />}
      </button>
      {error && <p className="absolute left-1/2 top-full mt-1 w-56 -translate-x-1/2 text-center text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
