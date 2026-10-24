"use client";

import { RequireLogin } from "@/components/LoginSheet";
import { orderRupees, rupees, rupeeTotal, UsdNote } from "@/components/Inr";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronDown, Copy, ExternalLink, LifeBuoy, Leaf, Navigation, PhoneCall, PiggyBank, Receipt, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { AfterDelivery } from "@/components/AfterDelivery";
import { ClaimTimeline } from "@/components/resolve/Claims";
import { warrantyDays, warrantyDaysLeft } from "@/lib/warranty";
import { api, money } from "@/components/api";
import { EventLog } from "@/components/EventLog";
import { FamilyPayShare } from "@/components/FamilyPay";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { SlotLine } from "@/components/SlotLine";
import { useLang } from "@/components/LanguageProvider";
import { langMeta } from "@/lib/i18n";
import { STATUS_PROGRESS, StatusPill } from "@/components/StatusPill";
import { Timeline } from "@/components/Timeline";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AVG_ITEM_KG, haversineKm } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { CompletionCheck, Karigar, Order, OrderStatus, Quote, Saathi } from "@/lib/types";

type Live = { lat: number; lng: number; at: string; simulated: boolean; etaMin: number | null; kmToGo: number | null; nextStop: string | null; vehicle: string };
type Data = {
  order: Order;
  karigar?: Karigar;
  saathi?: Saathi;
  quote?: Quote;
  live?: Live | null;
  trackUrl?: string;
  jobKarigars?: Record<string, { name: string; shop: string; avatarColor: string; lat: number; lng: number }>;
};


const SAATHI_POS: Partial<Record<OrderStatus, number>> = { authorized: 0.02, picked_up: 0.25, at_karigar: 0.5, repairing: 0.5, repaired: 0.5, out_for_delivery: 0.75, delivered: 0.99, paid_out: 0.99 };
const ACTIVE: OrderStatus[] = ["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"];

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RequireLogin roles={["customer", "admin"]}>
      <OrderPageInner params={params} />
    </RequireLogin>
  );
}

function OrderPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [payMyself, setPayMyself] = useState(false);
  const { t, lang } = useLang();

  const load = useCallback(() => {
    api<Data>(`/api/orders/${id}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  if (error && !data)
    return (
      <Card className="space-y-3 p-6">
        <p className="text-destructive">{error}</p>
        <Link href="/repairs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ArrowLeft className="size-4" /> {t("navRepairs")}
        </Link>
      </Card>
    );
  if (!data) return <Card className="h-64 animate-pulse" />;
  const { order, karigar, saathi, quote } = data;
  const captured = Boolean(order.paypal.captureId);
  const saved = order.jobs?.length
    ? order.jobs.reduce((s, j) => s + Math.max(0, j.newPrice - j.price), 0)
    : quote && quote.newPrice > 0
      ? Math.max(0, quote.newPrice - order.repairCharge)
      : 0;
  const keptKg = order.jobs?.length ? order.jobs.reduce((s, j) => s + AVG_ITEM_KG[j.category], 0) : AVG_ITEM_KG[order.category];
  const jobKarigars = Object.entries(data.jobKarigars ?? {});
  const mapPins =
    order.kind === "basket" && jobKarigars.length
      ? jobKarigars.map(([id, k]) => ({ id, name: k.name, lat: k.lat, lng: k.lng, color: k.avatarColor, label: k.shop }))
      : karigar
        ? [{ id: karigar.id, name: karigar.name, lat: karigar.lat, lng: karigar.lng, color: karigar.avatarColor, label: karigar.shop }]
        : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <section className="min-w-0 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  {order.id}
                  {order.bookedBy === "phone" && (
                    <Badge>
                      <PhoneCall /> {t("oBookedByPhone")}
                    </Badge>
                  )}
                  {order.bookedBy === "agent" && (
                    <Badge>
                      <Sparkles /> {t("oBookedByAi")}
                    </Badge>
                  )}
                </p>
                <h1 className="mt-1 text-2xl font-bold">{order.kind === "basket" && order.jobs ? t("oBasketTitle", { n: order.jobs.length }) : order.item}</h1>
                <p className="text-sm text-muted-foreground">{order.issue}</p>
                {!["delivered", "paid_out", "cancelled"].includes(order.status) && <SlotLine order={order} className="mt-1" />}
              </div>
              <StatusPill status={order.status} />
            </div>
            {order.status !== "cancelled" && <Progress value={STATUS_PROGRESS[order.status]} />}
            {order.kind === "basket" && jobKarigars.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
                <div className="flex -space-x-3">
                  {jobKarigars.map(([id, k]) => (
                    <Avatar key={id} name={k.name} color={k.avatarColor} className="size-10 ring-2 ring-card" />
                  ))}
                </div>
                <p className="min-w-0 text-xs text-muted-foreground">
                  <b className="text-foreground">{jobKarigars.length === 1 ? t("oKarigarOne") : t("oKarigarMany", { n: jobKarigars.length })}</b> · {jobKarigars.map(([, k]) => k.shop).join(", ")}
                  {saathi ? ` · ${t("oSaathi")}: ${saathi.name}` : ""}
                </p>
              </div>
            )}
            {karigar && order.kind !== "basket" && (
              <Link href={`/karigars/${karigar.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 ring-1 ring-border hover:bg-muted">
                <Avatar name={karigar.name} color={karigar.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold">
                    {karigar.shop} {karigar.onboarded && <BadgeCheck className="size-4 text-primary" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {karigar.name} · {karigar.ratingCount ? `${karigar.rating}★` : t("newKarigar")} · {order.distanceKm} km · {order.mode === "pickup" && saathi ? `${t("oSaathi")}: ${saathi.name}` : t("oHomeVisit")}
                  </p>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        {order.status === "awaiting_payment" && order.paypal.orderId && (
          <Card className="ring-1 ring-[#0070e0]/40">
            <CardContent className="space-y-3">
              <h2 className="text-lg font-bold">{t("oPayTitle")}</h2>
              <Breakdown order={order} />
              <p className="flex gap-2 rounded-2xl bg-[#0070e0]/10 p-3 text-xs text-paypal-blue">
                <ShieldCheck className="size-4 shrink-0" /> {t("oHoldNote")}
              </p>
              {order.familyPay && !payMyself ? (
                <div className="space-y-3 rounded-2xl bg-teal/10 p-3 ring-1 ring-teal/30">
                  <p className="text-sm">{t("oWaitingFamily", { name: order.familyPay.name, relation: order.familyPay.relation })}</p>
                  <FamilyPayShare orderId={order.id} token={order.familyPay.token} name={order.familyPay.name} item={order.item} total={orderRupees(order)} />
                  <button className="text-xs font-semibold text-primary underline" onClick={() => setPayMyself(true)}>
                    {t("payMyself")}
                  </button>
                </div>
              ) : (
                <PayPalCheckout orderId={order.id} paypalOrderId={order.paypal.orderId} total={order.total} inrLabel={orderRupees(order)} onApproved={load} />
              )}
            </CardContent>
          </Card>
        )}

        {order.priceChange && <PriceChangeCard order={order} onChange={load} />}

        {ACTIVE.includes(order.status) && (
          <div className="grid grid-cols-2 gap-3">
            <OtpCard label={order.mode === "pickup" ? t("oPickupOtp") : t("oArrivalOtp")} otp={order.pickupOtp} active={order.status === "authorized"} hint={order.mode === "pickup" ? t("oShareSaathi") : t("oShareArrive")} />
            <OtpCard
              label={order.mode === "pickup" ? t("oDeliveryOtp") : t("oJobDoneOtp")}
              otp={order.deliveryOtp}
              active={order.status === "out_for_delivery" || (order.mode === "home-visit" && order.status === "repaired")}
              hint={t("oReleaseHint")}
            />
          </div>
        )}

        {karigar && order.status !== "awaiting_payment" && order.status !== "cancelled" && (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{t("oLiveTracking")}</h2>
                {order.mode === "pickup" && <span className="text-xs text-muted-foreground">{t("oSaathiRoute")}</span>}
              </div>
              {data.live ? (
                <div className="flex items-start gap-3 rounded-2xl bg-teal/10 p-3 text-sm ring-1 ring-teal/25">
                  <Navigation className="mt-0.5 size-5 shrink-0 text-teal" />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {data.live.etaMin !== null ? t("trEta", { name: saathi?.name.split(" ")[0] ?? t("oSaathi"), min: data.live.etaMin, km: data.live.kmToGo ?? 0 }) : t("trLive")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.live.nextStop && `${t("trNext")}: ${data.live.nextStop} · `}
                      {t("trUpdated", { time: new Date(data.live.at).toLocaleTimeString(langMeta(lang).locale, { hour: "numeric", minute: "2-digit", second: "2-digit" }) })}
                      {data.live.simulated && ` · ${t("trDemoRide")}`}
                    </p>
                  </div>
                </div>
              ) : (
                order.mode === "pickup" && ["authorized", "picked_up", "out_for_delivery"].includes(order.status) && <p className="text-xs text-muted-foreground">{t("trWaiting")}</p>
              )}
              <NeighbourhoodMap
                center={{ lat: order.customer.lat, lng: order.customer.lng }}
                pins={mapPins}
                route={nearestFirst({ lat: order.customer.lat, lng: order.customer.lng }, mapPins).map((p) => p.id)}
                saathiProgress={order.mode === "pickup" && !data.live ? SAATHI_POS[order.status] : undefined}
                saathiAt={data.live ? { lat: data.live.lat, lng: data.live.lng, label: data.live.etaMin !== null ? `${saathi?.name.split(" ")[0] ?? ""} · ${data.live.etaMin} min` : undefined } : null}
                className="aspect-[400/220]"
              />
              {data.trackUrl && <ShareTracking url={data.trackUrl} />}
              <Timeline order={order} />
              {order.status === "authorized" && (
                <Button variant="destructive" size="sm" onClick={() => api(`/api/orders/${order.id}/action`, { action: "cancel" }).then(load).catch((e) => setError(e.message))}>
                  <XCircle /> {t("oCancel")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {order.kind === "basket" && order.jobs && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-bold">🪔 {t("oBasketTitle", { n: order.jobs.length })}</h2>
              <ul className="space-y-2">
                {order.jobs.map((j) => {
                  const jk = data.jobKarigars?.[j.karigarId];
                  return (
                    <li key={j.id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2.5 ring-1 ring-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {j.afterPhoto || j.beforePhoto ? <img src={`/api/uploads/${j.afterPhoto ?? j.beforePhoto}`} alt="" className="size-11 rounded-xl object-cover" /> : <Avatar name={jk?.name ?? "K"} color={jk?.avatarColor} className="size-11" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{j.item}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {jk?.shop} · {rupees(j.price)}
                        </p>
                        {j.completionCheck && !j.completionCheck.passed && <PhotoCheck check={j.completionCheck} compact />}
                      </div>
                      <Badge variant={j.status === "repaired" ? "solid" : j.status === "repairing" ? "gold" : "outline"}>{t(`oJob_${j.status}`)}</Badge>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {order.kind !== "basket" && (order.beforePhoto || order.afterPhoto) && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-bold">{t("oBeforeAfter")}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Photo label={t("oBefore")} file={order.beforePhoto} />
                <Photo label={t("oAfter")} file={order.afterPhoto} />
              </div>
              {order.completionCheck && <PhotoCheck check={order.completionCheck} />}
            </CardContent>
          </Card>
        )}

        {order.status === "paid_out" && (
          <Card className="relative overflow-hidden bg-gradient-to-br from-marigold/15 via-card to-teal/10">
            <CardContent className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">{t("oPassport")}</p>
              <h2 className="text-xl font-bold">{order.item}</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={PiggyBank} v={rupees(saved)} l={t("oSaved")} />
                <Stat icon={Leaf} v={`${keptKg.toFixed(1)} kg`} l={t("oKeptKg")} />
                <Stat icon={BadgeCheck} v={order.discount?.care ? t("oWarrantyDays30") : t("oWarrantyDays")} l={t("oWarranty")} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("oFixedBy", {
                  names: order.kind === "basket" ? jobKarigars.map(([, k]) => k.name.split(" ")[0]).join(", ") : (karigar?.name ?? ""),
                  date: new Date(order.events.findLast((e) => e.status === "paid_out")?.at ?? order.createdAt).toLocaleDateString(langMeta(lang).locale),
                })}
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="min-w-0 space-y-4">
        {(order.status === "delivered" || order.status === "paid_out") && (
          <AfterDelivery
            order={order}
            onChange={load}
            karigars={
              order.kind === "basket"
                ? jobKarigars.map(([kid, k]) => {
                    const job = order.jobs?.find((j) => j.karigarId === kid);
                    return { id: kid, name: k.name, shop: k.shop, avatarColor: k.avatarColor, issue: job?.issue ?? order.issue, category: job?.category ?? order.category };
                  })
                : karigar
                  ? [{ id: karigar.id, name: karigar.name, shop: karigar.shop, avatarColor: karigar.avatarColor, issue: order.issue, category: order.category }]
                  : []
            }
          />
        )}
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <Receipt className="size-4 text-primary" /> {t("oPayment")}
              </h2>
              <Badge variant="paypal">PayPal {order.paypal.mode}</Badge>
            </div>
            <Breakdown order={order} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <Ref k="PayPal order" v={order.paypal.orderId} />
              <Ref k="Authorization" v={order.paypal.authorizationId} />
              <Ref k="Capture" v={order.paypal.captureId} />
              <Ref k="Payout batch" v={order.paypal.payoutBatchId} />
              <Ref k="Invoice" v={order.paypal.invoiceId} />
              {order.paypal.refunds.map((r) => (
                <Ref key={r.id} k={`Refund ${money(r.amount)}`} v={`${r.id} (${r.status})`} />
              ))}
            </dl>
            {order.paypal.invoiceUrl && (
              <Button asChild variant="outline" className="w-full">
                <a href={order.paypal.invoiceUrl} target="_blank" rel="noreferrer">
                  {t("oViewInvoice")}
                </a>
              </Button>
            )}
            {order.payouts.length > 0 && (
              <div className="space-y-1 rounded-2xl bg-muted/50 p-3 text-xs ring-1 ring-border">
                <p className="mb-1 font-semibold">{t("oSplit")}</p>
                {order.payouts.map((p) => (
                  <Row key={`${p.to}-${p.label ?? ""}`} k={p.to === "karigar" ? `${p.label ?? "Karigar"} ${t("oKarigarShare")}` : `${p.label ?? t("oSaathi")} ${t("oSaathiShare")}`} v={`${money(p.amount)} · ${p.status}`} />
                ))}
                <Row k="Sudhaar" v={money(order.split.platform)} />
                {order.donation > 0 && <Row k={t("oToolFund")} v={money(order.donation)} />}
              </div>
            )}
          </CardContent>
        </Card>

        {captured && <ResolveHub order={order} />}

        <Card>
          <CardContent>
            <button onClick={() => setShowLog((v) => !v)} className="flex w-full items-center justify-between font-bold">
              {t("oLog")} <ChevronDown className={cn("size-4 transition", showLog && "rotate-180")} />
            </button>
            {showLog && (
              <div className="mt-4 space-y-2">
                {lang !== "en" && <p className="text-xs text-muted-foreground">{t("oLogNote")}</p>}
                <EventLog events={order.events} />
              </div>
            )}
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  );
}

/** Saathi stop order for a basket: always ride to the closest remaining karigar next. */
function nearestFirst<P extends { lat: number; lng: number }>(from: { lat: number; lng: number }, pins: P[]): P[] {
  const left = [...pins];
  const out: P[] = [];
  let at = from;
  while (left.length) {
    left.sort((a, b) => haversineKm(at, a) - haversineKm(at, b));
    const next = left.shift()!;
    out.push(next);
    at = next;
  }
  return out;
}

function Breakdown({ order }: { order: Order }) {
  const { t } = useLang();
  const repairs = order.jobs?.length ? order.jobs.map((j) => j.price) : [order.repairCharge];
  return (
    <div className="space-y-1.5">
      <Row k={t("oRepair")} v={rupeeTotal(...repairs)} />
      <Row k={order.kind === "basket" ? t("gharOneTrip") : order.mode === "pickup" ? t("oPickupKm", { km: order.distanceKm }) : t("oHomeVisit")} v={rupees(order.pickupFee)} />
      {order.donation > 0 && <Row k={t("oToolFund")} v={rupees(order.donation)} />}
      {order.discount?.care ? <Row k={t("careCovers")} v={`−${rupees(order.discount.care)}`} tone="text-teal" /> : null}
      {order.discount?.coupon ? <Row k={`${t("cpTitle")} ${order.discount.coupon.code}`} v={`−${rupees(order.discount.coupon.amount)}`} tone="text-teal" /> : null}
      <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
        <span>{t("oTotal")}</span>
        <span className="text-right">
          <span className="block">{orderRupees(order)}</span>
          <UsdNote usd={order.total} />
        </span>
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <p className={cn("flex justify-between gap-2", tone)}>
      <span className={tone ? undefined : "text-muted-foreground"}>{k}</span>
      <span className="text-right">{v}</span>
    </p>
  );
}

/** Shiprocket-style public tracking link the customer can send to family. */
function ShareTracking({ url }: { url: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const full = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-2.5 text-xs ring-1 ring-border">
      <span className="min-w-0 flex-1 text-muted-foreground">{t("trShare")}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard?.writeText(full).then(() => setCopied(true)).catch(() => {});
        }}
      >
        <Copy /> {copied ? t("trCopied") : t("trCopy")}
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink /> {t("trOpen")}
        </a>
      </Button>
    </div>
  );
}

function Ref({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="break-all font-mono">{v}</dd>
    </>
  );
}

function Stat({ icon: Icon, v, l }: { icon: React.ComponentType<{ className?: string }>; v: string; l: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
      <Icon className="mx-auto size-4 text-gold" />
      <p className="mt-1 font-display text-lg font-bold">{v}</p>
      <p className="text-[10px] text-muted-foreground">{l}</p>
    </div>
  );
}

function OtpCard({ label, otp, active, hint }: { label: string; otp: string; active: boolean; hint: string }) {
  return (
    <Card className={cn("text-center transition", active ? "ring-2 ring-primary" : "opacity-50")}>
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">{otp}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** The karigar's price change after inspection: nothing changes until the customer decides. */
function PriceChangeCard({ order, onChange }: { order: Order; onChange: () => void }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pc = order.priceChange!;
  const vars = { from: rupees(pc.from), to: rupees(pc.to), extra: rupees(pc.to - pc.from), reason: pc.reason };
  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/price-decision`, { approve });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (pc.status === "approved" || pc.status === "declined")
    return <p className="rounded-2xl bg-muted/60 p-3 text-sm ring-1 ring-border">{pc.item}: {pc.status === "approved" ? t("pcDone", vars) : t("pcKept", vars)}</p>;
  return (
    <Card className="ring-2 ring-marigold">
      <CardContent className="space-y-3">
        <h2 className="font-bold">{t("pcTitle")}</h2>
        <p className="text-sm">
          <b>{pc.item}</b>: <span className="line-through text-muted-foreground">{rupees(pc.from)}</span> → <b>{rupees(pc.to)}</b>
        </p>
        <p className="text-sm text-muted-foreground">{t("pcWhy", vars)}</p>
        {pc.status === "pending" && (
          <>
            <p className="text-xs text-muted-foreground">{pc.to > pc.from ? t("pcHigher", vars) : t("pcLower")}</p>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {t("pcApprove", vars)}
              </Button>
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                {t("pcDecline", vars)}
              </Button>
            </div>
          </>
        )}
        {pc.status === "awaiting_payment" && pc.topUp?.paypalOrderId && (
          <>
            <p className="text-sm font-semibold">{t("pcPayExtra", vars)}</p>
            <PayPalCheckout orderId={order.id} paypalOrderId={pc.topUp.paypalOrderId} total={pc.topUp.amount} onApproved={onChange} topUp />
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/** Customer-facing view of the before/after check that gates the PayPal capture. */
function PhotoCheck({ check, compact }: { check: CompletionCheck; compact?: boolean }) {
  const { t } = useLang();
  const by = check.source === "admin" ? t("oByTeam") : check.source === "simulated" ? t("oBySim") : t("oByAi");
  const [tone, title, body] = check.passed
    ? ["bg-teal/10 text-teal", t("oVerified", { by }), check.source === "admin" ? t("oAdminApproved") : check.reasoning]
    : check.needsReview
      ? ["bg-marigold/15 text-gold", t("oChecking"), t("oCheckingBody")]
      : ["bg-marigold/15 text-gold", t("oNotAccepted"), `${check.reasoning} ${t("oHoldStays")}`];
  if (compact) return <p className={cn("mt-1 rounded-lg px-2 py-1 text-[11px]", tone)}>{title}</p>;
  return (
    <p className={cn("rounded-2xl p-3 text-sm", tone)}>
      <b>{title}.</b> {body}
    </p>
  );
}

function Photo({ label, file }: { label: string; file?: string }) {
  const { t } = useLang();
  return (
    <figure>
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${file}`} alt={label} className="aspect-square w-full rounded-2xl object-cover ring-1 ring-border" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-2xl bg-muted/50 text-xs text-muted-foreground ring-1 ring-border">{t("oNoPhoto")}</div>
      )}
      <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function ResolveHub({ order }: { order: Order }) {
  const { t } = useLang();
  const left = warrantyDaysLeft(order);
  const open = order.complaints.some((c) => !c.resolution);
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <LifeBuoy className="size-4 text-gold" /> Resolve Hub
            </h2>
            <p className="text-xs text-muted-foreground">{left >= 0 ? t("rhWarrantyLeft", { n: left, days: warrantyDays(order) }) : t("rhWarrantyOver")}</p>
          </div>
          {left >= 0 && !open && (
            <Button asChild size="sm" variant="gold" className="h-auto min-h-8 max-w-[45%] whitespace-normal py-1.5 text-center">
              <Link href={`/resolve?order=${order.id}`}>{t("oReport")}</Link>
            </Button>
          )}
        </div>
        {order.complaints.map((c) => (
          <ClaimTimeline key={c.id} order={order} complaint={c} />
        ))}
        <Link href="/resolve" className="block text-xs font-semibold text-primary underline">
          {t("rhOpenHub")}
        </Link>
      </CardContent>
    </Card>
  );
}
