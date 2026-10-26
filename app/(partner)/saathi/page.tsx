"use client";

import { PhotoPicker } from "@/components/PhotoPicker";
import { ResendOtp } from "@/components/partner/ResendOtp";
import { useEffect, useMemo, useRef, useState } from "react";
import { Home, LocateFixed, MapPin, Navigation, Play, Square, Store } from "lucide-react";
import { api } from "@/components/api";
import { rupees } from "@/components/Inr";
import { useLang } from "@/components/LanguageProvider";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { EarningsList, PartnerHeader, PayoutCheck, StatStrip, TabsN, usePartner, WeekChart, type PartnerData } from "@/components/partner/PartnerHome";
import { SlotLine } from "@/components/SlotLine";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type KarigarBrief, type TripStops, useOrders } from "@/components/useOrders";
import { haversineKm } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

type LatLng = { lat: number; lng: number };
type Stop = { orderId: string; kind: "pickup" | "drop" | "collect" | "delivery"; label: string; at: LatLng; item: string };

// The Saathi app: only this Saathi's trips (the API filters them). OTPs are never sent to the
// Saathi; they must ask the customer, which proves the customer was really there.
export default function SaathiApp() {
  const { t } = useLang();
  const { orders, karigars, stops, reload } = useOrders();
  const partner = usePartner("saathi");
  const [tab, setTab] = useState("trips");
  const sid = partner.data?.profile.id;
  const trips = useMemo(
    () => orders.filter((o) => o.saathiId === sid && o.mode === "pickup" && ["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"].includes(o.status)),
    [orders, sid],
  );
  const live = partner.data?.sharingLocation ?? null;
  const route = useMemo(() => planRoute(trips, stops, live, karigars), [trips, stops, live, karigars]);

  if (partner.error) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-destructive">{partner.error}</p>;
  if (!partner.data || !sid) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-muted-foreground">…</p>;
  const d = partner.data;
  const refresh = () => {
    reload();
    partner.reload();
  };

  return (
    <div className="space-y-4">
      <PartnerHeader data={d} isAdmin={partner.isAdmin} viewAs={partner.viewAs} setViewAs={partner.setViewAs} onChange={partner.reload} />
      <StatStrip
        items={[
          { label: t("kaEarned"), value: rupees(d.totalEarned), sub: `$${d.totalEarned.toFixed(2)} · PayPal`, tone: "text-teal" },
          { label: t("ptThisWeek"), value: rupees(d.stats.weekTotal) },
          { label: t("saTrips"), value: String(trips.length), sub: t("ptStopsToday", { n: route.length }) },
          { label: t("ptDone"), value: String(d.stats.finished) },
          { label: t("ptKm"), value: `${d.stats.km ?? 0} km` },
          { label: t("ptRating"), value: `★ ${d.profile.rating}` },
        ]}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <TabsN
            value={tab}
            onChange={setTab}
            items={[
              ["trips", `${t("saTrips")} (${trips.length})`],
              ["route", `${t("ptRoute")} (${route.length})`],
              ["earnings", t("kaHistory")],
              ["profile", t("ptProfile")],
            ]}
          />
          {tab === "route" && <RoutePlan route={route} live={live} trips={trips} stops={stops} />}
          {tab === "trips" && (
            <div className="grid gap-3 xl:grid-cols-2">
              {trips.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground xl:col-span-2">{t("saNoTrips")}</p>}
              {trips.map((o) => (
                <Trip key={o.id} order={o} karigars={karigars} onDone={refresh} />
              ))}
            </div>
          )}
          {tab === "earnings" && (
            <div className="space-y-3">
              <PayoutCheck onDone={partner.reload} />
              <EarningsList data={d} />
            </div>
          )}
          {tab === "profile" && <SaathiProfile data={d} onSaved={partner.reload} disabled={partner.isAdmin} />}
        </section>
        <aside className="space-y-4">
          <LiveShare live={live} next={route[0]} disabled={partner.isAdmin} onChange={partner.reload} />
          <WeekChart week={d.week} />
          <div className="paper space-y-2 rounded-2xl p-4 text-xs">
            <p className="text-sm font-semibold">{t("ptHandover")}</p>
            <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>{t("ptHand1")}</li>
              <li>{t("ptHand2")}</li>
              <li>{t("ptHand3")}</li>
              <li>{t("ptHand4")}</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Each trip's next stop, ordered nearest-first from where the Saathi is now. */
function planRoute(trips: Order[], stops: TripStops, live: LatLng | null, karigars: Record<string, KarigarBrief>): Stop[] {
  const all: Stop[] = [];
  for (const o of trips) {
    const s = stops[o.id];
    if (!s) continue;
    const name = o.customer.name.split(" ")[0];
    const item = o.kind === "basket" ? `Ghar Safai · ${o.jobs?.length ?? 0}` : o.item;
    if (o.status === "authorized") all.push({ orderId: o.id, kind: "pickup", label: name, at: s.home, item });
    else if (o.status === "picked_up") for (const shop of s.shops) all.push({ orderId: o.id, kind: "drop", label: shop.shop, at: shop, item });
    else if (o.status === "repaired") for (const shop of s.shops) all.push({ orderId: o.id, kind: "collect", label: shop.shop || karigars[shop.id]?.shop || "", at: shop, item });
    else if (o.status === "out_for_delivery") all.push({ orderId: o.id, kind: "delivery", label: name, at: s.home, item });
  }
  const out: Stop[] = [];
  let at: LatLng | null = live ?? all[0]?.at ?? null;
  const left = [...all];
  while (left.length && at) {
    const here: LatLng = at;
    left.sort((a, b) => haversineKm(here, a.at) - haversineKm(here, b.at));
    const next = left.shift()!;
    out.push(next);
    at = next.at;
  }
  return out;
}

function RoutePlan({ route, live, trips, stops }: { route: Stop[]; live: LatLng | null; trips: Order[]; stops: TripStops }) {
  const { t } = useLang();
  const first = trips[0] && stops[trips[0].id];
  const center = live ?? route[0]?.at ?? first?.home;
  if (!center || route.length === 0) return <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("ptNoStops")}</p>;
  const kindLabel = (k: Stop["kind"]) => t(k === "pickup" ? "ptKindPickup" : k === "drop" ? "ptKindDrop" : k === "collect" ? "ptKindCollect" : "ptKindDelivery");
  return (
    <div className="space-y-3">
      <NeighbourhoodMap
        center={center}
        hideHome
        pins={route.map((s, i) => ({ id: `${s.orderId}-${i}`, name: String(i + 1), lat: s.at.lat, lng: s.at.lng, color: s.kind === "pickup" || s.kind === "delivery" ? "#d9572b" : "#1f8a7a", label: `${i + 1}. ${kindLabel(s.kind)} · ${s.label}` }))}
        path={[...(live ? [live] : []), ...route.map((s) => s.at)]}
        saathiAt={live ? { ...live, label: t("ptYou") } : null}
        className="h-80"
      />
      <ol className="space-y-2">
        {route.map((s, i) => (
          <li key={`${s.orderId}-${i}`} className="paper flex items-center gap-3 rounded-2xl p-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white", s.kind === "pickup" || s.kind === "delivery" ? "bg-primary" : "bg-teal")}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {s.kind === "pickup" || s.kind === "delivery" ? <Home className="size-3.5 text-primary" /> : <Store className="size-3.5 text-teal" />}
                {kindLabel(s.kind)} · {s.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{s.orderId}</span> · {s.item}
                {live && ` · ${haversineKm(live, s.at).toFixed(1)} km`}
              </p>
            </div>
            <a
              href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=${live ? `${live.lat},${live.lng}` : ""};${s.at.lat},${s.at.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/10"
            >
              <Navigation className="size-3.5" /> {t("ptNavigate")}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Live location: real GPS from this phone (watchPosition), or a clearly labelled demo ride that
 * moves the dot to the next stop so judges can see live tracking from a desk.
 */
function LiveShare({ live, next, disabled, onChange }: { live: PartnerData["sharingLocation"]; next?: Stop; disabled: boolean; onChange: () => void }) {
  const { t } = useLang();
  const [mode, setMode] = useState<"off" | "gps" | "demo">("off");
  const [error, setError] = useState<string | null>(null);
  const watch = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSent = useRef(0);

  const send = (p: LatLng, simulated: boolean) => api("/api/partner/location", { lat: p.lat, lng: p.lng, simulated }).then(onChange).catch((e) => setError((e as Error).message));
  function stopAll(clear: boolean) {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    if (timer.current) clearInterval(timer.current);
    watch.current = null;
    timer.current = null;
    setMode("off");
    if (clear) void api("/api/partner/location", { stop: true }).then(onChange).catch(() => {});
  }
  useEffect(() => () => stopAll(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  function startGps() {
    stopAll(false);
    setError(null);
    if (!navigator.geolocation) return setError(t("ptNoGps"));
    setMode("gps");
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        // At most one update every 4 seconds.
        if (Date.now() - lastSent.current < 4000) return;
        lastSent.current = Date.now();
        void send({ lat: pos.coords.latitude, lng: pos.coords.longitude }, false);
      },
      () => {
        setError(t("ptGpsDenied"));
        stopAll(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  function startDemo() {
    if (!next) return setError(t("ptNoStops"));
    stopAll(false);
    setError(null);
    setMode("demo");
    // Start about 1.2 km from the next stop (or from the last position) and ride there in ~40 s.
    const from = live ?? { lat: next.at.lat + 0.008, lng: next.at.lng - 0.007 };
    const steps = 20;
    let i = 0;
    void send(from, true);
    timer.current = setInterval(() => {
      i += 1;
      const f = i / steps;
      void send({ lat: from.lat + (next.at.lat - from.lat) * f, lng: from.lng + (next.at.lng - from.lng) * f }, true);
      if (i >= steps) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setMode("off");
      }
    }, 2000);
  }

  return (
    <div className="paper space-y-3 rounded-2xl p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <LocateFixed className="size-4 text-teal" /> {t("ptLiveTitle")}
      </p>
      <p className="text-xs text-muted-foreground">{t("ptLiveSub")}</p>
      {live ? (
        <p className="rounded-xl bg-teal/10 px-3 py-2 text-xs text-teal ring-1 ring-teal/25">
          {t("ptSharing", { time: new Date(live.at).toLocaleTimeString() })}
          {live.simulated && ` · ${t("trDemoRide")}`}
        </p>
      ) : (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{t("ptNotSharing")}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {mode === "gps" ? (
          <Button size="sm" variant="outline" onClick={() => stopAll(true)}>
            <Square /> {t("ptStopSharing")}
          </Button>
        ) : (
          <Button size="sm" disabled={disabled} onClick={startGps}>
            <MapPin /> {t("ptShareGps")}
          </Button>
        )}
        {mode === "demo" ? (
          <Button size="sm" variant="outline" onClick={() => stopAll(false)}>
            <Square /> {t("ptStopDemo")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={disabled || !next} onClick={startDemo}>
            <Play /> {t("ptDemoRide")}
          </Button>
        )}
      </div>
      {next && <p className="text-[11px] text-muted-foreground">{t("ptDemoNote", { stop: next.label })}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SaathiProfile({ data, onSaved, disabled }: { data: PartnerData; onSaved: () => void; disabled: boolean }) {
  const { t } = useLang();
  const [area, setArea] = useState(data.profile.area ?? "");
  const [vehicle, setVehicle] = useState(data.profile.vehicle ?? "bicycle");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="paper max-w-xl space-y-3 rounded-2xl p-5">
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">{t("ptArea")}</span>
        <Input value={area} onChange={(e) => setArea(e.target.value)} disabled={disabled} />
      </label>
      <div className="space-y-1 text-sm">
        <p className="font-semibold">{t("ptVehicle")}</p>
        <div className="flex flex-wrap gap-1.5">
          {(["walk", "bicycle", "scooter", "motorbike"] as const).map((v) => (
            <button key={v} disabled={disabled} onClick={() => setVehicle(v)} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", vehicle === v ? "bg-primary text-primary-foreground ring-primary" : "ring-border")}>
              {t(`veh_${v}`)}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("ptVehicleNote")}</p>
      </div>
      <Button
        disabled={disabled}
        onClick={() =>
          api("/api/partner/profile", { area, vehicle })
            .then(() => {
              setMsg(t("ptSaved"));
              onSaved();
            })
            .catch((e) => setMsg((e as Error).message))
        }
      >
        {t("ptSave")}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

function Trip({ order, karigars, onDone }: { order: Order; karigars: Record<string, KarigarBrief>; onDone: () => void }) {
  const { t } = useLang();
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const basket = order.kind === "basket";
  const shops = [...new Set(basket ? (order.jobs ?? []).map((j) => j.karigarId) : [order.karigarId])].map((id) => karigars[id]).filter(Boolean);
  const step =
    order.status === "authorized"
      ? { action: "pickup", label: t("saPickup"), otp: true }
      : order.status === "picked_up"
        ? { action: "drop_at_karigar", label: basket ? t("saDropBasket") : t("saDrop"), otp: false }
        : order.status === "repaired"
          ? { action: "out_for_delivery", label: t("saCollect"), otp: false }
          : order.status === "out_for_delivery"
            ? { action: "deliver", label: t("saDeliver"), otp: true }
            : null;

  // No photo of the item yet (phone bookings): the Saathi takes it at pickup for the AI repair check.
  const needsPhoto = step?.action === "pickup" && (basket ? (order.jobs ?? []).some((j) => !j.beforePhoto) : !order.beforePhoto);
  async function run() {
    if (!step) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/action`, { action: step.action, otp, beforePhoto: photo });
      setOtp("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper space-y-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
          <p className="font-semibold">{basket ? `🪔 ${t("oBasketTitle", { n: order.jobs?.length ?? 0 })}` : order.item}</p>
          <p className="text-xs text-muted-foreground">
            {order.distanceKm} km · {t("saEarn", { amount: rupees(order.split.saathi) })}
          </p>
          {order.status === "authorized" && <SlotLine order={order} className="mt-1" />}
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs ring-1 ring-border">
        <p className="font-semibold text-muted-foreground">{t("saStops")}</p>
        <p className="flex items-center gap-2">
          <Home className="size-3.5 shrink-0 text-primary" /> {order.customer.name} · {order.customer.address || "—"}
        </p>
        {shops.map((k) => (
          <p key={k.shop} className="flex items-center gap-2">
            <Store className="size-3.5 shrink-0 text-teal" /> {k.shop} · <MapPin className="size-3 shrink-0" /> {k.area}
          </p>
        ))}
      </div>
      {!step && <p className="text-xs text-muted-foreground">{t("saWaitRepair")}</p>}
      {step && (
        <>
          {step.otp && (
            <>
              <p className="text-xs text-muted-foreground">{t("saAskOtp")}</p>
              <Input className="text-center font-mono text-xl tracking-[0.5em]" inputMode="numeric" maxLength={4} placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
              <ResendOtp orderId={order.id} />
            </>
          )}
          {needsPhoto && (
            <div className="space-y-1">
              <p className="text-xs font-semibold">{t("saBeforePhoto")}</p>
              <PhotoPicker compact label={t("saBeforePhotoBtn")} onUploaded={(f) => setPhoto(f)} />
            </div>
          )}
          <Button className="w-full" disabled={busy || (step.otp && otp.length !== 4) || (needsPhoto && order.bookedBy === "phone" && !photo)} onClick={run}>
            {busy ? "…" : step.label}
          </Button>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
