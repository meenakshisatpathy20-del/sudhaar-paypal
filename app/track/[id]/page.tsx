"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Bike, CheckCircle2, Circle, Navigation, Package, Store } from "lucide-react";
import { api } from "@/components/api";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { SlotLine } from "@/components/SlotLine";
import { StatusPill } from "@/components/StatusPill";
import { Card, CardContent } from "@/components/ui/card";
import { langMeta, type StringKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, PickupSlot } from "@/lib/types";

type Tracking = {
  id: string;
  item: string;
  status: OrderStatus;
  mode: "pickup" | "home-visit";
  createdAt: string;
  pickupSlot?: PickupSlot;
  steps: { key: OrderStatus; label: string; at: string | null; done: boolean }[];
  karigar: { shop: string; name: string; area: string } | null;
  shops: { shop: string; area: string; lat: number; lng: number }[];
  saathi: { name: string; vehicle: string; rating: number } | null;
  home: { lat: number; lng: number };
  live: { lat: number; lng: number; at: string; simulated: boolean; etaMin: number | null; kmToGo: number | null; nextStop: string | null } | null;
};

// Shiprocket-style public tracking page: anyone with the link (e.g. a son in another city) can follow
// the repair, see the Saathi on the map and the ETA. No login, no OTPs, no prices.
export default function TrackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = use(params);
  const token = use(searchParams).t ?? "";
  const { t, lang } = useLang();
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ tracking: Tracking }>(`/api/track/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`)
      .then((r) => {
        setData(r.tracking);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id, token]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);
  const time = (iso: string) => new Date(iso).toLocaleString(langMeta(lang).locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="min-h-screen pb-10">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">{t("trTitle")}</span>
          <div className="ml-auto">
            <LangToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6">
        {error && !data && <Card className="mx-auto max-w-md p-6 text-sm text-destructive">{error}</Card>}
        {!data && !error && <Card className="h-64 animate-pulse" />}
        {data && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <section className="min-w-0 space-y-4">
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {t("trNumber")}: {data.id}
                      </p>
                      <h1 className="text-2xl font-bold">{data.item}</h1>
                      {data.pickupSlot && !["delivered", "paid_out", "cancelled"].includes(data.status) && <SlotLine order={{ pickupSlot: data.pickupSlot, mode: data.mode } as Order} className="mt-1" />}
                    </div>
                    <StatusPill status={data.status} />
                  </div>
                  {data.live ? (
                    <div className="flex items-start gap-3 rounded-2xl bg-teal/10 p-3 text-sm ring-1 ring-teal/25">
                      <Navigation className="mt-0.5 size-5 shrink-0 text-teal" />
                      <div>
                        <p className="font-semibold">{data.live.etaMin !== null ? t("trEta", { name: data.saathi?.name ?? t("oSaathi"), min: data.live.etaMin, km: data.live.kmToGo ?? 0 }) : t("trLive")}</p>
                        <p className="text-xs text-muted-foreground">
                          {data.live.nextStop && `${t("trNext")}: ${data.live.nextStop} · `}
                          {t("trUpdated", { time: new Date(data.live.at).toLocaleTimeString(langMeta(lang).locale, { hour: "numeric", minute: "2-digit", second: "2-digit" }) })}
                          {data.live.simulated && ` · ${t("trDemoRide")}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    data.mode === "pickup" && ["authorized", "picked_up", "out_for_delivery"].includes(data.status) && <p className="text-xs text-muted-foreground">{t("trWaiting")}</p>
                  )}
                  <NeighbourhoodMap
                    center={data.home}
                    pins={data.shops.map((s, i) => ({ id: `shop-${i}`, name: s.shop, lat: s.lat, lng: s.lng, color: "#1f8a7a", label: s.shop }))}
                    route={data.shops.map((_, i) => `shop-${i}`)}
                    saathiAt={data.live ? { lat: data.live.lat, lng: data.live.lng, label: data.saathi?.name } : null}
                    className="aspect-[16/9]"
                  />
                </CardContent>
              </Card>
            </section>
            <section className="min-w-0 space-y-4">
              <Card>
                <CardContent className="space-y-1">
                  <h2 className="mb-2 font-bold">{t("trTimeline")}</h2>
                  <ol className="relative space-y-0">
                    {data.steps.map((s, i) => (
                      <li key={s.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          {s.done ? <CheckCircle2 className="size-5 text-teal" /> : <Circle className="size-5 text-muted-foreground/50" />}
                          {i < data.steps.length - 1 && <span className={cn("my-0.5 w-px flex-1", s.done ? "bg-teal/50" : "bg-border")} />}
                        </div>
                        <div className="pb-4">
                          <p className={cn("text-sm", s.done ? "font-semibold" : "text-muted-foreground")}>{t(`${data.mode === "pickup" ? "trStep_" : "trVisit_"}${s.key}` as StringKey)}</p>
                          {s.at && <p className="text-[11px] text-muted-foreground">{time(s.at)}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-2 text-sm">
                  {data.shops.map((s) => (
                    <p key={s.shop} className="flex items-center gap-2">
                      <Store className="size-4 shrink-0 text-teal" /> <b>{s.shop}</b> · {s.area}
                    </p>
                  ))}
                  {data.saathi && (
                    <p className="flex items-center gap-2">
                      <Bike className="size-4 shrink-0 text-primary" /> {t("oSaathi")}: <b>{data.saathi.name}</b> · {data.saathi.vehicle} · ★ {data.saathi.rating}
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="size-4 shrink-0" /> {t("trPrivacy")}
                  </p>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
