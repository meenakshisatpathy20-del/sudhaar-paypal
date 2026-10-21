"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { LANGS, langMeta } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLang } from "./LanguageProvider";

/** Language picker: every language shown in its own script, so people can find theirs. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-secondary"
      >
        <Languages className="size-3.5 text-primary" /> {langMeta(lang).short} <ChevronDown className="size-3 text-muted-foreground" />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-border">
          {LANGS.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={lang === l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", lang === l.code && "bg-primary/10")}
            >
              <span>
                <span className="font-semibold">{l.native}</span>
                {l.code !== "en" && <span className="ml-1.5 text-xs text-muted-foreground">{l.english}</span>}
              </span>
              {lang === l.code && <Check className="size-4 text-primary" />}
            </button>
          ))}
          <p className="px-3 pb-1 pt-1.5 text-[10px] leading-snug text-muted-foreground">{t("langReview")}</p>
        </div>
      )}
    </div>
  );
}
