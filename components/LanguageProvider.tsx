"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STRINGS, type Lang, type StringKey } from "@/lib/i18n";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StringKey) => string; speakReplies: boolean; setSpeakReplies: (v: boolean) => void };
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [speakReplies, setSpeakState] = useState(true);

  useEffect(() => {
    try {
      const l = localStorage.getItem("sudhaar.lang");
      if (l === "hi" || l === "en") setLangState(l);
      if (localStorage.getItem("sudhaar.speak") === "0") setSpeakState(false);
    } catch {
      // storage unavailable: keep defaults
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("sudhaar.lang", l);
    } catch {}
  }, []);
  const setSpeakReplies = useCallback((v: boolean) => {
    setSpeakState(v);
    try {
      localStorage.setItem("sudhaar.speak", v ? "1" : "0");
    } catch {}
  }, []);
  const t = useCallback((k: StringKey) => STRINGS[lang][k] ?? STRINGS.en[k], [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t, speakReplies, setSpeakReplies }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
