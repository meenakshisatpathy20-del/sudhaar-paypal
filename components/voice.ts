"use client";

// Browser speech helpers (Web Speech API): speech-to-text for input, text-to-speech for replies.
// Works in Chrome/Edge (desktop + Android). Falls back gracefully where unsupported.
// Each app language uses its Indian locale (hi-IN, bn-IN, ta-IN …); voices depend on the device.

import { type Lang, langMeta } from "@/lib/i18n";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function speechSupported() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startListening(lang: Lang, onText: (text: string, final: boolean) => void, onEnd: () => void, onError: (msg: string) => void) {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    onError("Voice input is not supported in this browser. Try Chrome.");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = langMeta(lang).locale;
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = e.results[i].isFinal;
    }
    onText(text, final);
  };
  rec.onend = onEnd;
  rec.onerror = (e) => onError(e.error === "not-allowed" ? "Microphone permission was denied." : `Voice error: ${e.error}`);
  rec.start();
  return () => rec.stop();
}

export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*_`#>]/g, "").replace(/\$(\d)/g, "$1 dollars ");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = langMeta(lang).locale;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)) && v.lang.includes("IN")) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
