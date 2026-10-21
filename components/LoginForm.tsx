"use client";

import { useState } from "react";
import { Check, KeyRound, LocateFixed, Loader2, Sparkles } from "lucide-react";
import { api } from "./api";
import { useLang } from "./LanguageProvider";
import { useSession } from "./SessionProvider";
import { useGeolocate } from "./useGeolocate";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

/** Customer log in / sign up with phone + PIN, plus a one-tap demo login for judges. */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const { t } = useLang();
  const { refresh } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ name: "", phone: "", pin: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const geo = useGeolocate();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: k === "pin" ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value }));

  async function go(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(path, body);
      await refresh();
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = form.phone.replace(/\D/g, "").length >= 10 && form.pin.length === 4 && (mode === "login" || form.name.trim());
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(["login", "signup"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-lg py-1.5 text-sm font-semibold", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {m === "login" ? t("tabLogin") : t("tabSignup")}
          </button>
        ))}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) go(mode === "login" ? "/api/auth/login" : "/api/auth/signup", mode === "login" ? { phone: form.phone, pin: form.pin } : { ...form, ...coords });
        }}
      >
        {mode === "signup" && <Input placeholder={t("joinName")} value={form.name} onChange={set("name")} autoComplete="name" />}
        <Input placeholder={t("joinPhonePh")} value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" />
        <Input placeholder={mode === "login" ? t("fPin") : t("fPinNew")} value={form.pin} onChange={set("pin")} inputMode="numeric" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "signup" && <Input placeholder={t("fAddress")} value={form.address} onChange={set("address")} autoComplete="street-address" />}
        {mode === "signup" && (
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={geo.busy} onClick={async () => setCoords((await geo.locate()) ?? coords)}>
            {geo.busy ? <Loader2 className="animate-spin" /> : coords ? <Check className="text-teal" /> : <LocateFixed />} {geo.busy ? t("locLocating") : coords ? t("locAdded") : t("locUseMine")}
          </Button>
        )}
        {mode === "signup" && geo.error && <p className="text-xs text-muted-foreground">{geo.error}</p>}
        <Button className="w-full" size="lg" type="submit" disabled={!ready || busy}>
          <KeyRound /> {mode === "login" ? t("btnLogin") : t("btnSignup")}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-1 rounded-xl bg-teal/10 p-3 ring-1 ring-teal/25">
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => go("/api/auth/demo", { role: "customer" })}>
          <Sparkles /> {t("demoBtn")}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">{t("demoNote")}</p>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">{t("pinNote")}</p>
    </div>
  );
}
