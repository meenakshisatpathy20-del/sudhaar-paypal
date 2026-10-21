"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, LifeBuoy, Leaf, PiggyBank, Receipt, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { api, money } from "@/components/api";
import { EventLog } from "@/components/EventLog";
import { FamilyPayShare } from "@/components/FamilyPay";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { PhotoPicker } from "@/components/PhotoPicker";
import { STATUS_PROGRESS, StatusPill } from "@/components/StatusPill";
import { Timeline } from "@/components/Timeline";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AVG_ITEM_KG } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Complaint, CompletionCheck, Karigar, Order, OrderStatus, Quote, Saathi } from "@/lib/types";

type Data = { order: Order; karigar?: Karigar; saathi?: Saathi; quote?: Quote; jobKarigars?: Record<string, { name: string; shop: string; avatarColor: string }> };

const ISSUES: { id: Complaint["issue"]; label: string }[] = [
  { id: "repair_failed", label: "Repair failed" },
  { id: "damaged", label: "Item damaged" },
  { id: "overcharged", label: "Overcharged" },
  { id: "delayed", label: "Delayed" },
  { id: "missing", label: "Item missing" },
];

const SAATHI_POS: Partial<Record<OrderStatus, number>> = { authorized: 0.02, picked_up: 0.25, at_karigar: 0.5, repairing: 0.5, repaired: 0.5, out_for_delivery: 0.75, delivered: 0.99, paid_out: 0.99 };
const ACTIVE: OrderStatus[] = ["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"];

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [payMyself, setPayMyself] = useState(false);

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

  if (error && !data) return <Card className="p-6 text-destructive">{error}</Card>;
  if (!data) return <Card className="h-64 animate-pulse" />;
  const { order, karigar, saathi, quote } = data;
  const captured = Boolean(order.paypal.captureId);
  const refunded = order.paypal.refunds.reduce((s, r) => s + r.amount, 0);
  const saved = order.jobs?.length
    ? order.jobs.reduce((s, j) => s + Math.max(0, j.newPrice - j.price), 0)
    : quote && quote.newPrice > 0
      ? Math.max(0, quote.newPrice - order.repairCharge)
      : 0;
  const keptKg = order.jobs?.length ? order.jobs.reduce((s, j) => s + AVG_ITEM_KG[j.category], 0) : AVG_ITEM_KG[order.category];
  const jobKarigars = Object.entries(data.jobKarigars ?? {});

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <section className="min-w-0 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  {order.id}
                  {order.bookedBy === "agent" && (
                    <Badge>
                      <Sparkles /> Booked by Sudhaar AI
                    </Badge>
                  )}
                </p>
                <h1 className="mt-1 text-2xl font-bold">{order.item}</h1>
                <p className="text-sm text-muted-foreground">{order.issue}</p>
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
                  <b className="text-foreground">{jobKarigars.length} karigar{jobKarigars.length === 1 ? "" : "s"}</b> · {jobKarigars.map(([, k]) => k.shop).join(", ")}
                  {saathi ? ` · Saathi: ${saathi.name}` : ""}
                </p>
              </div>
            )}
            {karigar && order.kind !== "basket" && (
              <Link href={`/karigars/${karigar.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 ring-1 ring-border hover:bg-muted">
                <Avatar name={karigar.name} color={karigar.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold">
                    {karigar.shop} <BadgeCheck className="size-4 text-primary" />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {karigar.name} · {karigar.rating}★ · {order.distanceKm} km · {order.mode === "pickup" && saathi ? `Saathi: ${saathi.name}` : "Home visit"}
                  </p>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        {order.status === "awaiting_payment" && order.paypal.orderId && (
          <Card className="ring-1 ring-[#0070e0]/40">
            <CardContent className="space-y-3">
              <h2 className="text-lg font-bold">Pay securely with PayPal</h2>
              <Breakdown order={order} />
              <p className="flex gap-2 rounded-2xl bg-[#0070e0]/10 p-3 text-xs text-paypal-blue">
                <ShieldCheck className="size-4 shrink-0" /> Your money is authorized and held, not taken. PayPal captures it only after you share the delivery OTP. Cancel before pickup and the hold is released.
              </p>
              {order.familyPay && !payMyself ? (
                <div className="space-y-3 rounded-2xl bg-teal/10 p-3 ring-1 ring-teal/30">
                  <p className="text-sm">
                    Waiting for <b>{order.familyPay.name}</b> ({order.familyPay.relation}) to pay. Send them the link: they approve it with their own PayPal from anywhere.
                  </p>
                  <FamilyPayShare orderId={order.id} name={order.familyPay.name} item={order.item} total={money(order.total)} />
                  <button className="text-xs font-semibold text-primary underline" onClick={() => setPayMyself(true)}>
                    Or pay yourself
                  </button>
                </div>
              ) : (
                <PayPalCheckout orderId={order.id} paypalOrderId={order.paypal.orderId} total={order.total} onApproved={load} />
              )}
            </CardContent>
          </Card>
        )}

        {ACTIVE.includes(order.status) && (
          <div className="grid grid-cols-2 gap-3">
            <OtpCard label={order.mode === "pickup" ? "Pickup OTP" : "Arrival OTP"} otp={order.pickupOtp} active={order.status === "authorized"} hint={order.mode === "pickup" ? "Share with your Saathi" : "Share when the karigar arrives"} />
            <OtpCard
              label={order.mode === "pickup" ? "Delivery OTP" : "Job-done OTP"}
              otp={order.deliveryOtp}
              active={order.status === "out_for_delivery" || (order.mode === "home-visit" && order.status === "repaired")}
              hint="Sharing it releases the payment"
            />
          </div>
        )}

        {karigar && order.status !== "awaiting_payment" && order.status !== "cancelled" && (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Live tracking</h2>
                {order.mode === "pickup" && <span className="text-xs text-muted-foreground">Saathi route · home ⇄ karigar</span>}
              </div>
              <NeighbourhoodMap
                center={{ lat: order.customer.lat, lng: order.customer.lng }}
                pins={[{ id: karigar.id, name: karigar.name, lat: karigar.lat, lng: karigar.lng, color: karigar.avatarColor, label: karigar.shop }]}
                selected={karigar.id}
                saathiProgress={order.mode === "pickup" ? SAATHI_POS[order.status] : undefined}
                className="aspect-[400/220]"
              />
              <Timeline order={order} />
              {order.status === "authorized" && (
                <Button variant="destructive" size="sm" onClick={() => api(`/api/orders/${order.id}/action`, { action: "cancel" }).then(load).catch((e) => setError(e.message))}>
                  <XCircle /> Cancel and release the PayPal hold
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {order.kind === "basket" && order.jobs && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-bold">🪔 Ghar Safai basket · {order.jobs.length} items</h2>
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
                          {jk?.shop} · {money(j.price)}
                        </p>
                        {j.completionCheck && !j.completionCheck.passed && <PhotoCheck check={j.completionCheck} compact />}
                      </div>
                      <Badge variant={j.status === "repaired" ? "solid" : j.status === "repairing" ? "gold" : "outline"}>{j.status}</Badge>
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
              <h2 className="font-bold">Before & after</h2>
              <div className="grid grid-cols-2 gap-3">
                <Photo label="Before" file={order.beforePhoto} />
                <Photo label="After" file={order.afterPhoto} />
              </div>
              {order.completionCheck && <PhotoCheck check={order.completionCheck} />}
            </CardContent>
          </Card>
        )}

        {order.status === "paid_out" && (
          <Card className="relative overflow-hidden bg-gradient-to-br from-marigold/15 via-card to-teal/10">
            <CardContent className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">Item Passport · second life</p>
              <h2 className="text-xl font-bold">{order.item}</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={PiggyBank} v={money(saved)} l="saved" />
                <Stat icon={Leaf} v={`${keptKg.toFixed(1)} kg`} l="kept from landfill" />
                <Stat icon={BadgeCheck} v="15 days" l="warranty" />
              </div>
              <p className="text-xs text-muted-foreground">
                Fixed by {order.kind === "basket" ? jobKarigars.map(([, k]) => k.name.split(" ")[0]).join(", ") : karigar?.name} on {new Date(order.events.findLast((e) => e.status === "paid_out")?.at ?? order.createdAt).toLocaleDateString()}.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="min-w-0 space-y-4">
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <Receipt className="size-4 text-primary" /> Payment
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
                  View PayPal invoice
                </a>
              </Button>
            )}
            {order.payouts.length > 0 && (
              <div className="space-y-1 rounded-2xl bg-muted/50 p-3 text-xs ring-1 ring-border">
                <p className="mb-1 font-semibold">Instant split via PayPal Payouts</p>
                {order.payouts.map((p) => (
                  <Row key={`${p.to}-${p.label ?? ""}`} k={p.to === "karigar" ? `${p.label ?? "Karigar"} (90% of repair)` : `${p.label ?? "Saathi"} (75% of pickup)`} v={`${money(p.amount)} · ${p.status}`} />
                ))}
                <Row k="Sudhaar" v={money(order.split.platform)} />
                {order.donation > 0 && <Row k="Karigar tool fund" v={money(order.donation)} />}
              </div>
            )}
          </CardContent>
        </Card>

        {captured && <ResolveHub order={order} refunded={refunded} onChange={load} />}

        <Card>
          <CardContent>
            <button onClick={() => setShowLog((v) => !v)} className="flex w-full items-center justify-between font-bold">
              Activity & PayPal log <ChevronDown className={cn("size-4 transition", showLog && "rotate-180")} />
            </button>
            {showLog && (
              <div className="mt-4">
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

function Breakdown({ order }: { order: Order }) {
  return (
    <div className="space-y-1.5">
      <Row k="Repair" v={money(order.repairCharge)} />
      <Row k={order.kind === "basket" ? "One Saathi trip for everything" : order.mode === "pickup" ? `Pickup & delivery (${order.distanceKm} km)` : "Home visit"} v={money(order.pickupFee)} />
      {order.donation > 0 && <Row k="Karigar tool fund" v={money(order.donation)} />}
      <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
        <span>Total</span>
        <span>{money(order.total)}</span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </p>
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

/** Customer-facing view of the before/after check that gates the PayPal capture. */
function PhotoCheck({ check, compact }: { check: CompletionCheck; compact?: boolean }) {
  const by = check.source === "admin" ? "Sudhaar team" : check.source === "claude" ? "AI" : "Simulated AI";
  const [tone, title, body] = check.passed
    ? ["bg-primary/10 text-primary", `Repair verified (${by})`, check.reasoning]
    : check.needsReview
      ? ["bg-marigold/15 text-gold", "The Sudhaar team is checking the photos", "Your money stays on hold with PayPal until the repair is confirmed."]
      : ["bg-marigold/15 text-gold", "Repair not accepted yet", `${check.reasoning} Your money stays on hold with PayPal.`];
  if (compact) return <p className={cn("mt-1 rounded-lg px-2 py-1 text-[11px]", tone)}>{title}</p>;
  return (
    <p className={cn("rounded-2xl p-3 text-sm", tone)}>
      <b>{title}.</b> {body}
    </p>
  );
}

function Photo({ label, file }: { label: string; file?: string }) {
  return (
    <figure>
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${file}`} alt={label} className="aspect-square w-full rounded-2xl object-cover ring-1 ring-border" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-2xl bg-muted/50 text-xs text-muted-foreground ring-1 ring-border">No photo</div>
      )}
      <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function ResolveHub({ order, refunded, onChange }: { order: Order; refunded: number; onChange: () => void }) {
  const [issue, setIssue] = useState<Complaint["issue"]>("repair_failed");
  const [details, setDetails] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/complaint`, { issue, details, photo });
      setDetails("");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }


  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <LifeBuoy className="size-4 text-gold" /> Resolve Hub
            </h2>
            <p className="text-xs text-muted-foreground">15-day warranty. Your PayPal invoice is attached as proof.</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="gold">
                Report an issue
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>What went wrong?</SheetTitle>
              <SheetDescription>AI reviews your complaint, the bill and the photos, then suggests a fair fix.</SheetDescription>
              <div className="flex flex-wrap gap-1.5">
                {ISSUES.map((i) => (
                  <button key={i.id} onClick={() => setIssue(i.id)} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", issue === i.id ? "bg-primary text-primary-foreground ring-primary" : "ring-border")}>
                    {i.label}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-3 text-xs">
                <p className="font-semibold">Bill attached automatically</p>
                <p className="text-muted-foreground">
                  Invoice <span className="font-mono">{order.paypal.invoiceId ?? "pending"}</span> · capture <span className="font-mono">{order.paypal.captureId}</span> · paid {money(order.total)}
                  {refunded > 0 && ` · refunded ${money(refunded)}`}
                </p>
              </div>
              <Textarea placeholder="Tell us what happened" value={details} onChange={(e) => setDetails(e.target.value)} />
              <PhotoPicker compact label="Add a photo (optional)" onUploaded={(f) => setPhoto(f)} />
              <Button size="lg" disabled={busy || !details.trim()} onClick={submit}>
                {busy ? "AI is reviewing…" : "Submit complaint"}
              </Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </SheetContent>
          </Sheet>
        </div>

        {order.complaints.map((c) => (
          <div key={c.id} className="space-y-2 rounded-2xl bg-muted/50 p-3 text-sm ring-1 ring-border">
            <p className="font-semibold">
              {ISSUES.find((i) => i.id === c.issue)?.label} <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
            </p>
            <p className="text-muted-foreground">{c.details}</p>
            {c.ai && (
              <p className="rounded-xl bg-primary/10 p-2 text-xs text-primary">
                <b>
                  AI recommends {c.ai.recommendation.replaceAll("_", " ")}
                  {c.ai.refundAmount ? ` of ${money(c.ai.refundAmount)}` : ""}
                </b>{" "}
                ({c.ai.source}): {c.ai.reasoning}
              </p>
            )}
            {c.resolution ? (
              <p className="text-xs font-semibold text-primary">
                Resolved: {c.resolution.action.replaceAll("_", " ")}
                {c.resolution.amount ? ` ${money(c.resolution.amount)}` : ""} {c.resolution.refundId && <span className="font-mono">({c.resolution.refundId})</span>}
              </p>
            ) : (
              <p className="rounded-xl bg-marigold/15 p-2.5 text-xs text-[#7a4a06]">
                ⏳ Sudhaar&apos;s support team is reviewing this, usually within a few hours. Any PayPal refund or free re-repair will appear right here.
              </p>
            )}
          </div>
        ))}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
