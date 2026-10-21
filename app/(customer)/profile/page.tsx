"use client";

import { rupees } from "@/components/Inr";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Handshake, Leaf, Loader2, LocateFixed, LogOut, MapPin, PiggyBank, ShieldCheck, Volume2, Wrench } from "lucide-react";
import { api } from "@/components/api";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/components/LanguageProvider";
import { RequireLogin } from "@/components/LoginSheet";
import { ModeBadges } from "@/components/ModeBadges";
import { useSession } from "@/components/SessionProvider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocate } from "@/components/useGeolocate";
import { AVG_ITEM_KG } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

export default function Profile() {
  return (
    <RequireLogin>
      <ProfileInner />
    </RequireLogin>
  );
}

type Resp = { orders: Order[]; quotes: Record<string, { newPrice: number }> };

function ProfileInner() {
  const { t, speakReplies, setSpeakReplies } = useLang();
  const { account, logout } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  useEffect(() => {
    api<Resp>("/api/orders").then(setData).catch(() => {});
  }, []);
  // This customer's own impact, from their completed repairs.
  const done = (data?.orders ?? []).filter((o) => o.paypal.captureId);
  const items = done.flatMap((o) => (o.jobs?.length ? o.jobs.map((j) => ({ category: j.category, price: j.price, newPrice: j.newPrice })) : [{ category: o.category, price: o.repairCharge, newPrice: data?.quotes[o.quoteId]?.newPrice ?? 0 }]));
  const impact = data && {
    itemsRepaired: items.length,
    kgSaved: Math.round(items.reduce((s, i) => s + AVG_ITEM_KG[i.category], 0) * 10) / 10,
    moneySaved: items.reduce((s, i) => s + Math.max(0, i.newPrice - i.price), 0),
    karigarEarnings: done.reduce((s, o) => s + o.payouts.filter((p) => p.to === "karigar").reduce((a, p) => a + p.amount, 0), 0),
  };
  if (!account) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 to-card">
        <CardContent className="flex items-center gap-4">
          <Avatar name={account.name} color="#0f766e" className="size-16 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{account.name}</h1>
            {account.address && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" /> {account.address}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{account.phone}</p>
            {account.demo && <p className="mt-1 text-[11px] text-muted-foreground">{t("demoProfile")}</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              router.push("/");
            }}
          >
            <LogOut /> {t("logout")}
          </Button>
        </CardContent>
      </Card>

      <LocationCard />

      {impact && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-bold">{t("yourImpact")}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: Wrench, v: String(impact.itemsRepaired), l: t("impactItems") },
                { icon: Leaf, v: `${impact.kgSaved}`, l: t("impactKg") },
                { icon: PiggyBank, v: rupees(impact.moneySaved), l: t("impactSaved") },
                { icon: Handshake, v: rupees(impact.karigarEarnings), l: t("impactKarigar") },
              ].map((x) => (
                <div key={x.l} className="rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
                  <x.icon className="size-4 text-gold" />
                  <p className="mt-1 font-display text-xl font-bold">{x.v}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{x.l}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-medium">{t("language")}</span>
            <LangToggle />
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Volume2 className="size-4 text-primary" /> {t("voiceReplies")}
            </span>
            <button
              role="switch"
              aria-checked={speakReplies}
              onClick={() => setSpeakReplies(!speakReplies)}
              className={cn("relative h-6 w-11 rounded-full transition", speakReplies ? "bg-primary" : "bg-input")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition", speakReplies ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-[#0050b3]" /> {t("payments")}
            </span>
            <ModeBadges />
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

/** Where this customer's pickups start and maps are centred: the device location plus an editable address. */
function LocationCard() {
  const { t } = useLang();
  const { account, refresh } = useSession();
  const geo = useGeolocate();
  const [address, setAddress] = useState(account?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const at = coords ?? (account?.lat !== undefined && account?.lng !== undefined ? { lat: account.lat, lng: account.lng } : null);

  async function save(next: { lat: number; lng: number } | null) {
    if (!next) return;
    setState("saving");
    setError(null);
    try {
      await api("/api/me/location", { ...next, address });
      await refresh();
      setState("saved");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <Card id="location">
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <MapPin className="size-4 text-primary" /> {t("locTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{at ? t("locLive") : t("locDemo")}</p>
        <Input placeholder={t("fAddress")} value={address} onChange={(e) => (setAddress(e.target.value), setState("idle"))} autoComplete="street-address" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left"
            disabled={geo.busy || state === "saving"}
            onClick={async () => {
              const p = await geo.locate();
              if (p) {
                setCoords(p);
                await save(p);
              }
            }}
          >
            {geo.busy ? <Loader2 className="animate-spin" /> : <LocateFixed />} {geo.busy ? t("locLocating") : t("locUseMine")}
          </Button>
          {at && (
            <Button size="sm" disabled={state === "saving" || !address.trim() || address.trim() === account?.address} onClick={() => save(at)}>
              {t("locSave")}
            </Button>
          )}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-teal">
              <Check className="size-3.5" /> {t("locSaved")}
            </span>
          )}
        </div>
        {at && <p className="font-mono text-[11px] text-muted-foreground">{at.lat.toFixed(4)}, {at.lng.toFixed(4)}</p>}
        {(geo.error || error) && <p className="text-xs text-destructive">{geo.error ?? error}</p>}
      </CardContent>
    </Card>
  );
}
