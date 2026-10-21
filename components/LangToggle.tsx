"use client";

import { cn } from "@/lib/utils";
import { useLang } from "./LanguageProvider";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn("flex rounded-full bg-white/[0.06] p-0.5 text-xs font-semibold ring-1 ring-white/10", className)} role="group" aria-label="Language">
      {(["en", "hi"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={cn("rounded-full px-2.5 py-1 transition", lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
