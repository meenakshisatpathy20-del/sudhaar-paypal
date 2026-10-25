"use client";

import Link from "next/link";
import { useState } from "react";
import { api, money } from "../api";
import { NeighbourhoodMap } from "../NeighbourhoodMap";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import type { CallbackRequest, SmsMessage, Coupon, Order, VoiceCall } from "@/lib/types";

export type Money = { held: number; captured: number; tipsIn: number; paidOut: number; refunded: number; discounts: number; careMembers: number; careMonthly: number };
export type PayPalEvent = { at: string; orderId: string; message: string; ref: string; error: boolean };
export type FleetRow = { id: string; name: string; vehicle: string; online: boolean; trips: number; location: { lat: number; lng: number; at: string; simulated: boolean } | null };
export type AccountRow = { id: string; role: string; name: string; phone: string; createdAt: string; demo: boolean; care: string | null };

/** Where the money is right now, and which PayPal APIs have been exercised. */
export function MoneyOverview({ m, orders, activity, webhooks, carePlan }: { m: Money; orders: Order[]; activity: PayPalEvent[]; webhooks: number; carePlan: { planId?: string } | null }) {
  const count = (re: RegExp) => activity.filter((a) => !a.error && re.test(a.message)).length;
  const apis: [string, string, number | string][] = [
    ["Orders v2 · create (AUTHORIZE / CAPTURE)", "Every booking, price top-up and tip", count(/PayPal order created|hold for the extra|tip/i) || orders.filter((o) => o.paypal.orderId).length],
    ["Orders v2 · authorize", "Money held at booking", orders.filter((o) => o.paypal.authorizationId).length],
    ["Payments v2 · capture", "Delivery OTP captures the hold", orders.filter((o) => o.paypal.captureId).length],
    ["Payments v2 · void", "Cancelled before pickup", count(/voided/i)],
    ["Payments v2 · refund", "Resolve Hub decisions", orders.reduce((s, o) => s + o.paypal.refunds.length, 0)],
    ["Payouts v1 · create + get", "Karigar, Saathi and tip payouts", orders.filter((o) => o.paypal.payoutBatchId).length + orders.reduce((s, o) => s + (o.tips ?? []).filter((t) => t.payoutBatchId).length, 0)],
    ["Invoicing v2", "Paid bill for every order", orders.filter((o) => o.paypal.invoiceId).length],
    ["Catalog Products + Billing Plans", "Sudhaar Care plan", carePlan?.planId ? "created" : "on first subscriber"],
    ["Subscriptions v1", "Care members (active)", m.careMembers],
    ["Webhooks v1 · verify signature", "Events received", webhooks],
    ["JS SDK v6", "Checkout button, Family Pay, tips", "in browser"],
    ["Agent Toolkit", "Talk agent reads orders, invoices, refunds, transactions, disputes", "with keys"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Held by PayPal now", money(m.held), "Authorized, waiting for delivery OTP"],
          ["Captured", money(m.captured), "After delivery OTP"],
          ["Paid out (Payouts)", money(m.paidOut), "Karigars, Saathis, tips"],
          ["Refunded", money(m.refunded), "Resolve Hub"],
          ["Tips captured", money(m.tipsIn), "100% paid out to karigars"],
          ["Discounts given", money(m.discounts), "Coupons + Care, from Sudhaar's share"],
          ["Care members", String(m.careMembers), "PayPal Subscriptions"],
          ["Care billing / month", money(m.careMonthly), "Covers free pickups"],
        ].map(([k, v, sub]) => (
          <div key={k} className="paper rounded-2xl p-3">
            <p className="font-display text-xl font-bold text-primary">{v}</p>
            <p className="text-xs font-semibold">{k}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="paper rounded-2xl p-4">
          <p className="mb-2 font-semibold">PayPal APIs in use</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {apis.map(([api, what, n]) => (
                <tr key={api}>
                  <td className="py-1.5 pr-2 font-medium">{api}</td>
                  <td className="py-1.5 pr-2 text-xs text-muted-foreground">{what}</td>
                  <td className="py-1.5 text-right font-mono text-xs">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="paper rounded-2xl p-4">
          <p className="mb-2 font-semibold">Latest PayPal calls</p>
          <ActivityList items={activity.slice(0, 9)} />
        </div>
      </div>
    </div>
  );
}

export function ActivityList({ items }: { items: PayPalEvent[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No PayPal calls yet. Book a repair to see them here.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {items.map((a, i) => (
        <li key={`${a.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
          <span className="w-36 shrink-0 text-[11px] text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
          <Link href={`/orders/${a.orderId}`} className="font-mono text-xs text-primary underline">
            {a.orderId}
          </Link>
          <span className={cn("min-w-0 flex-1", a.error && "text-destructive")}>{a.message}</span>
          {a.ref && <span className="break-all font-mono text-[11px] text-muted-foreground">{a.ref}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Create, edit and switch off coupon codes. Usage counts paid bookings only. */
export function CouponsAdmin({ coupons, onDone }: { coupons: Coupon[]; onDone: () => void }) {
  const blank = { code: "", description: "", kind: "flat" as "flat" | "percent", value: "", maxInr: "", minOrderInr: "", maxUses: "", firstOrderOnly: false, basketOnly: false };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/coupons", { action: "save", coupon: { ...form, value: Number(form.value) } });
      setForm(blank);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="paper overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Offer</th>
              <th className="px-3 py-2">Rules</th>
              <th className="px-3 py-2">Used</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {coupons.map((c) => (
              <tr key={c.code} className={cn(!c.active && "opacity-50")}>
                <td className="px-3 py-2 font-mono font-semibold">{c.code}</td>
                <td className="px-3 py-2">
                  {c.description}
                  <span className="block text-[11px] text-muted-foreground">{c.kind === "flat" ? `₹${c.value} off` : `${c.value}% off${c.maxInr ? ` up to ₹${c.maxInr}` : ""}`}</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[c.firstOrderOnly && "first repair", c.basketOnly && "baskets", c.minOrderInr && `min ₹${c.minOrderInr}`, c.maxUses && `max ${c.maxUses} uses`].filter(Boolean).join(" · ") || "any repair"}
                </td>
                <td className="px-3 py-2 font-mono">{c.uses}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => api("/api/coupons", { action: "toggle", code: c.code }).then(onDone)}>
                    {c.active ? "Turn off" : "Turn on"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="p-3 text-[11px] text-muted-foreground">Each code can be used once per customer. The discount is capped at Sudhaar&apos;s share of the booking and is sent to PayPal as a discount line.</p>
      </div>
      <div className="paper space-y-2 rounded-2xl p-4">
        <p className="font-semibold">New coupon</p>
        <Input placeholder="CODE (e.g. MONSOON30)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="font-mono" />
        <Input placeholder="Description customers see" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-2">
          {(["flat", "percent"] as const).map((k) => (
            <button key={k} onClick={() => setForm({ ...form, kind: k })} className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ring-1", form.kind === k ? "bg-primary text-primary-foreground ring-primary" : "ring-border")}>
              {k === "flat" ? "₹ off" : "% off"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder={form.kind === "flat" ? "₹ amount" : "Percent"} inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^\d.]/g, "") })} />
          {form.kind === "percent" && <Input placeholder="Up to ₹" inputMode="numeric" value={form.maxInr} onChange={(e) => setForm({ ...form, maxInr: e.target.value.replace(/\D/g, "") })} />}
          <Input placeholder="Min order ₹" inputMode="numeric" value={form.minOrderInr} onChange={(e) => setForm({ ...form, minOrderInr: e.target.value.replace(/\D/g, "") })} />
          <Input placeholder="Max uses" inputMode="numeric" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/\D/g, "") })} />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} /> First repair only
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.basketOnly} onChange={(e) => setForm({ ...form, basketOnly: e.target.checked })} /> Ghar Safai baskets only
        </label>
        <Button className="w-full" disabled={busy || !form.code || !form.value} onClick={save}>
          Save coupon
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function CareAdmin({ accounts, m, carePlan }: { accounts: AccountRow[]; m: Money; carePlan: { productId?: string; planId?: string; mode?: string } | null }) {
  const members = accounts.filter((a) => a.care);
  return (
    <div className="space-y-3">
      <div className="paper grid gap-2 rounded-2xl p-4 text-sm md:grid-cols-3">
        <p>
          Active members: <b>{m.careMembers}</b>
        </p>
        <p>
          Billing per month: <b>{money(m.careMonthly)}</b>
        </p>
        <p className="text-xs text-muted-foreground">
          PayPal plan: <span className="font-mono">{carePlan?.planId ?? "created on the first subscription"}</span>
          {carePlan?.productId && (
            <>
              {" "}
              · product <span className="font-mono">{carePlan.productId}</span>
            </>
          )}
        </p>
      </div>
      <div className="paper divide-y divide-border rounded-2xl px-4">
        {members.length === 0 && <p className="py-4 text-sm text-muted-foreground">No subscribers yet. Customers join at /care.</p>}
        {members.map((a) => (
          <p key={a.id} className="flex justify-between py-2.5 text-sm">
            <span>
              {a.name} <span className="text-xs text-muted-foreground">{a.phone}</span>
            </span>
            <span className={cn("rounded-full px-2 text-xs font-semibold", a.care === "ACTIVE" ? "bg-teal/15 text-teal" : "bg-muted text-muted-foreground")}>{a.care}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** Every Saathi's live position (when shared in the last 10 minutes). */
export function FleetMap({ fleet }: { fleet: FleetRow[] }) {
  const located = fleet.filter((f) => f.location);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      {located.length ? (
        <NeighbourhoodMap
          center={located[0].location!}
          hideHome
          pins={located.map((f) => ({ id: f.id, name: f.name, lat: f.location!.lat, lng: f.location!.lng, color: "#1f8a7a", label: `${f.name.split(" ")[0]}${f.location!.simulated ? " (demo ride)" : ""}` }))}
          className="h-[420px]"
        />
      ) : (
        <p className="paper rounded-2xl p-6 text-sm text-muted-foreground">No Saathi is sharing a live location right now. In the Saathi app, press Share GPS or Demo ride.</p>
      )}
      <div className="paper divide-y divide-border rounded-2xl px-4">
        {fleet.map((f) => (
          <div key={f.id} className="py-2.5 text-sm">
            <p className="flex justify-between font-semibold">
              {f.name} <span className={cn("text-xs", f.online ? "text-teal" : "text-muted-foreground")}>{f.online ? "online" : "offline"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {f.vehicle} · {f.trips} active trip{f.trips === 1 ? "" : "s"} · {f.location ? `live ${new Date(f.location.at).toLocaleTimeString()}${f.location.simulated ? " (demo)" : ""}` : "not sharing"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export type VoiceAdmin = { functions: boolean; callback: boolean; phoneNumber: string | null; calls: VoiceCall[]; sms?: { provider: string; log: SmsMessage[] }; callbacks?: CallbackRequest[]; timings?: { firstReminderMin: number; secondReminderMin: number; pickupLeadMin: number } };

/** The Bolna phone line: setup status, recent calls and bookings made by phone (with their pay links). */
export function PhoneLineAdmin({ voice, orders, onChange }: { voice: VoiceAdmin; orders: Order[]; onChange?: () => void }) {
  const booked = orders.filter((o) => o.bookedBy === "phone");
  const [copied, setCopied] = useState<string | null>(null);
  const item = (ok: boolean, label: string, hint: string) => (
    <div className={cn("rounded-xl p-3 text-sm ring-1", ok ? "bg-teal/10 ring-teal/25" : "bg-muted ring-border")}>
      <p className="font-semibold">
        {ok ? "✓" : "○"} {label}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {item(voice.functions, "Voice functions", voice.functions ? "VOICE_API_TOKEN is set: Bolna can quote, book, track, cancel and file claims." : "Set VOICE_API_TOKEN and add the functions in Bolna (docs/BOLNA.md).")}
        {item(Boolean(voice.phoneNumber), "Phone number", voice.phoneNumber ? `Shown on the website: ${voice.phoneNumber}` : "Set VOICE_PHONE_NUMBER to show the number customers dial.")}
        {item(voice.callback, "Call me (outbound)", voice.callback ? "BOLNA_API_KEY and BOLNA_AGENT_ID are set." : "Set BOLNA_API_KEY and BOLNA_AGENT_ID to let customers ask for a call.")}
        {item(voice.sms?.provider === "twilio", "SMS", voice.sms?.provider === "twilio" ? "Twilio is set: pay links, OTPs and updates are texted." : "No SMS provider: texts are only logged below (simulated). Set SMS_PROVIDER=twilio and the TWILIO_* keys.")}
      </div>
      <CustomerLookup />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Callbacks items={voice.callbacks ?? []} onChange={onChange} />
        <Conductor voice={voice} onChange={onChange} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="paper space-y-2 rounded-2xl p-4">
          <p className="font-semibold">Bookings made by phone ({booked.length})</p>
          {booked.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          {booked.map((o) => {
            const link = o.familyPay?.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${o.id}?t=${o.familyPay.token}` : "";
            return (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm">
                <span>
                  <Link href={`/orders/${o.id}`} className="font-mono text-xs text-primary underline">
                    {o.id}
                  </Link>{" "}
                  {o.item} · {o.customer.name} · <span className="text-muted-foreground">{o.status.replaceAll("_", " ")}</span>
                </span>
                {voice.callback && <CallButton orderId={o.id} who={o.status === "awaiting_payment" && o.familyPay?.phone ? "payer" : "customer"} onDone={onChange} />}
                {o.status === "awaiting_payment" && link && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(link).then(() => setCopied(o.id)).catch(() => {});
                    }}
                  >
                    {copied === o.id ? "Copied" : "Copy PayPal pay link"}
                  </Button>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">A phone booking is paid through its Family Pay link (PayPal), texted to the payer&apos;s mobile when the call books it. Copy it here to send it again on WhatsApp. Nothing is charged until it&apos;s approved, and money is only captured after delivery.</p>
        </div>
        <div className="paper space-y-2 rounded-2xl p-4 lg:col-span-2">
          <p className="font-semibold">
            SMS log ({voice.sms?.log.length ?? 0}){" "}
            <span className="text-xs font-normal text-muted-foreground">{voice.sms?.provider === "twilio" ? "· sent with Twilio" : "· simulated: no SMS provider set"} · OTPs are masked</span>
          </p>
          {!voice.sms?.log.length && <p className="text-sm text-muted-foreground">No texts yet. They are sent when a phone booking is made, a payment is held, an item is out for delivery, a price changes or a claim needs the customer.</p>}
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {voice.sms?.log.map((m) => (
              <div key={m.id} className="grid grid-cols-[110px_90px_120px_1fr_auto] items-start gap-2 border-t border-border pt-1.5 text-xs">
                <span className="text-muted-foreground">{new Date(m.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                <span className="font-mono">{m.to}</span>
                <span>
                  {m.kind.replaceAll("_", " ")}
                  {m.orderId && <span className="block font-mono text-[10px] text-muted-foreground">{m.orderId}</span>}
                </span>
                <span className="break-words">{m.text}</span>
                <span className={cn("rounded-full px-2 py-0.5 font-semibold", m.status === "sent" ? "bg-teal/15 text-teal" : m.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")} title={m.error}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="paper space-y-2 rounded-2xl p-4">
          <p className="font-semibold">Recent calls ({voice.calls.length})</p>
          {voice.calls.length === 0 && <p className="text-sm text-muted-foreground">No calls logged yet. Point Bolna&apos;s post-call webhook at /api/voice/webhook.</p>}
          {voice.calls.slice(0, 20).map((c) => (
            <details key={c.id} className="border-t border-border pt-2 text-sm">
              <summary className="cursor-pointer">
                {c.direction === "outbound" ? "↗ to" : "↙ from"} {c.direction === "outbound" ? `••••••${(c.to ?? "").slice(-4)}` : c.from || "unknown"} · {new Date(c.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                {c.reason ? ` · ${c.reason.replaceAll("_", " ")}` : ""} · {c.status || "—"}
                {c.durationSec ? ` · ${c.durationSec}s` : ""}
                {c.orderIds?.length ? ` · ${c.orderIds.join(", ")}` : ""}
              </summary>
              {c.summary && <p className="mt-1 text-xs">{c.summary}</p>}
              {c.transcript && <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">{c.transcript}</pre>}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

function CallButton({ orderId, who, onDone }: { orderId: string; who: "payer" | "customer"; onDone?: () => void }) {
  const [state, setState] = useState<string | null>(null);
  async function call() {
    setState("calling…");
    try {
      const r = await api<{ call: VoiceCall | null }>("/api/admin/call", { orderId, who });
      setState(r.call?.status ?? "queued");
      onDone?.();
    } catch (e) {
      setState((e as Error).message);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={call} disabled={state === "calling…"} title="The Sudhaar agent places an outbound call with Bolna">
      {state ?? (who === "payer" ? "📞 Call payer" : "📞 Call customer")}
    </Button>
  );
}

/** People who asked the phone agent for a human. The team calls back and marks it done. */
function Callbacks({ items, onChange }: { items: CallbackRequest[]; onChange?: () => void }) {
  const open = items.filter((c) => c.status === "open");
  async function done(id: string) {
    await api("/api/admin/callbacks", { id }).catch(() => {});
    onChange?.();
  }
  return (
    <div className="paper space-y-2 rounded-2xl p-4">
      <p className="font-semibold">
        Asked for a person{" "}
        <span className={cn("rounded-full px-2 text-xs", open.length ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{open.length} open</span>
      </p>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No requests. When a caller wants a human, the agent files one here (tool: request_callback) and texts them that we&apos;ll call.</p>}
      {items.slice(0, 12).map((c) => (
        <div key={c.id} className={cn("flex flex-wrap items-start justify-between gap-2 border-t border-border pt-2 text-sm", c.status === "done" && "opacity-60")}>
          <div className="min-w-0">
            <p className="font-medium">
              {c.name ?? "New caller"} · <span className="font-mono text-xs">{c.phone}</span>
              {c.orderId && <span className="font-mono text-xs text-muted-foreground"> · {c.orderId}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(c.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {c.reason}
            </p>
          </div>
          {c.status === "open" ? (
            <Button size="sm" variant="outline" onClick={() => done(c.id)}>
              Called back ✓
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">done by {c.doneBy}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** The conductor: reminders, expiry notices and reminder calls, run every minute or on demand. */
function Conductor({ voice, onChange }: { voice: VoiceAdmin; onChange?: () => void }) {
  const [out, setOut] = useState<string[] | null>(null);
  const t = voice.timings;
  async function run() {
    const r = await api<{ done: string[] }>("/api/admin/conductor", {}).catch((e) => ({ done: [(e as Error).message] }));
    setOut(r.done ?? []);
    onChange?.();
  }
  return (
    <div className="paper space-y-2 rounded-2xl p-4">
      <p className="font-semibold">Conductor (automatic follow-ups)</p>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        <li>Payer hasn&apos;t paid after {t ? Math.round(t.firstReminderMin / 60) : 2} h: reminder SMS{voice.callback ? " + a call from the agent (phone bookings)" : ""}; again at {t ? Math.round(t.secondReminderMin / 60) : 20} h.</li>
        <li>Not paid in 24 h: booking released, customer and payer told by SMS.</li>
        <li>Paid after the pickup time passed: pickup moves to the next free window.</li>
        <li>{t?.pickupLeadMin ?? 60} min before pickup: SMS{voice.callback ? " + a reminder call for phone customers" : ""}.</li>
        <li>New paid job: the karigar and the Saathi get it by SMS.</li>
      </ul>
      <Button size="sm" variant="outline" onClick={run}>
        Run now
      </Button>
      {out && <p className="text-xs">{out.length ? out.join(" · ") : "Nothing due right now."}</p>}
    </div>
  );
}

type Timeline = { at: string; kind: string; text: string; ref: string }[];
type Lookup = { customer: { name: string; phone: string; address: string; viaPhone: boolean; care: boolean }; more: number; stats: Record<string, number>; calls: VoiceCall[]; timeline: Timeline };

/** One customer on one screen: calls (with transcripts), SMS, orders, claims and callback requests. */
function CustomerLookup() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function find() {
    setError(null);
    try {
      setData(await api<Lookup>(`/api/admin/customer?q=${encodeURIComponent(q)}`));
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    }
  }
  const icon: Record<string, string> = { order: "🧾", claim: "🛟", call: "📞", sms: "💬", callback: "🙋" };
  return (
    <div className="paper space-y-3 rounded-2xl p-4">
      <p className="font-semibold">Customer timeline</p>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="Phone number, name or order number (e.g. 98765 or SD1A2B3C)" />
        <Button onClick={find} disabled={q.trim().length < 3}>
          Look up
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <div className="space-y-2">
          <p className="text-sm">
            <b>{data.customer.name}</b> · <span className="font-mono">{data.customer.phone}</span>
            {data.customer.viaPhone && <span className="ml-1 rounded-full bg-primary/10 px-2 text-xs text-primary">joined by phone</span>}
            {data.customer.care && <span className="ml-1 rounded-full bg-teal/15 px-2 text-xs text-teal">Care</span>}
            {data.more > 0 && <span className="text-xs text-muted-foreground"> · {data.more} more match</span>}
            <span className="block text-xs text-muted-foreground">{data.customer.address}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {data.stats.orders} orders · {data.stats.openClaims} open claims · {data.stats.calls} calls · {data.stats.sms} SMS · {data.stats.openCallbacks} waiting for a callback
          </p>
          <ol className="max-h-96 space-y-1 overflow-y-auto">
            {data.timeline.map((e) => {
              const call = e.kind === "call" ? data.calls.find((c) => c.id === e.ref) : undefined;
              return (
                <li key={`${e.kind}-${e.ref}-${e.at}`} className="border-t border-border pt-1 text-xs">
                  <span className="text-muted-foreground">{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> {icon[e.kind]} {e.text}
                  {call?.transcript && (
                    <details>
                      <summary className="cursor-pointer text-primary">Transcript</summary>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">{call.transcript}</pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
