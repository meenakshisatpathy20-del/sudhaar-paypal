"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api, money } from "@/components/api";
import { EventLog } from "@/components/EventLog";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusPill } from "@/components/StatusPill";
import { Timeline } from "@/components/Timeline";
import type { Complaint, Karigar, Order, Quote, Saathi } from "@/lib/types";

type Data = { order: Order; karigar?: Karigar; saathi?: Saathi; quote?: Quote };

const ISSUES: { id: Complaint["issue"]; label: string }[] = [
  { id: "repair_failed", label: "Repair failed" },
  { id: "damaged", label: "Item damaged" },
  { id: "overcharged", label: "Overcharged" },
  { id: "delayed", label: "Delayed" },
  { id: "missing", label: "Item missing" },
];

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !data) return <p className="card text-red-600">{error}</p>;
  if (!data) return <p className="card text-muted">Loading order…</p>;
  const { order, karigar, saathi, quote } = data;
  const captured = Boolean(order.paypal.captureId);
  const refunded = order.paypal.refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <section className="min-w-0 space-y-4">
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-muted">
                Order {order.id} {order.bookedBy === "agent" && <span className="pill ml-1 bg-brand-light text-brand-dark">Booked by Repair Agent</span>}
              </p>
              <h1 className="text-xl font-bold">{order.item}</h1>
              <p className="text-sm text-muted">{order.issue}</p>
            </div>
            <StatusPill status={order.status} />
          </div>
          {karigar && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm">
              <span className="grid h-10 w-10 place-items-center rounded-full font-bold text-white" style={{ background: karigar.avatarColor }}>
                {karigar.name[0]}
              </span>
              <div className="flex-1">
                <p className="font-semibold">
                  {karigar.shop} <span className="pill bg-brand text-white">✓ KYC</span>
                </p>
                <p className="text-xs text-muted">
                  {karigar.name} · {karigar.rating}★ · {order.distanceKm} km · {karigar.area}
                  {order.mode === "pickup" && saathi ? ` · Saathi: ${saathi.name}` : " · Home visit"}
                </p>
              </div>
            </div>
          )}
        </div>

        {order.status === "awaiting_payment" && order.paypal.orderId && (
          <div className="card space-y-3">
            <h2 className="font-bold">Pay securely with PayPal</h2>
            <Breakdown order={order} />
            <p className="rounded-xl bg-[#e8f0fe] p-3 text-xs text-[#003087]">
              Your money is <b>authorized and held</b>, not taken. PayPal captures it only after you confirm the delivery OTP. If you cancel before pickup the hold
              is released.
            </p>
            <PayPalCheckout orderId={order.id} paypalOrderId={order.paypal.orderId} total={order.total} onApproved={load} />
          </div>
        )}

        {["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"].includes(order.status) && (
          <div className="grid grid-cols-2 gap-3">
            <OtpCard
              label={order.mode === "pickup" ? "Pickup OTP" : "Arrival OTP"}
              otp={order.pickupOtp}
              active={order.status === "authorized"}
              hint={order.mode === "pickup" ? "Share with the Saathi at pickup" : "Share when the karigar arrives"}
            />
            <OtpCard
              label={order.mode === "pickup" ? "Delivery OTP" : "Job-done OTP"}
              otp={order.deliveryOtp}
              active={order.status === "out_for_delivery" || (order.mode === "home-visit" && order.status === "repaired")}
              hint="Sharing it releases the payment"
            />
          </div>
        )}

        <div className="card">
          <h2 className="mb-3 font-bold">Live tracking</h2>
          <Timeline order={order} />
          {order.status === "authorized" && (
            <button
              className="mt-4 text-xs font-semibold text-red-600 hover:underline"
              onClick={() => api(`/api/orders/${order.id}/action`, { action: "cancel" }).then(load).catch((e) => setError(e.message))}
            >
              Cancel booking and release the PayPal hold
            </button>
          )}
          {["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"].includes(order.status) && (
            <p className="mt-4 text-xs text-muted">
              Demo tip: play the other roles in the <Link className="font-semibold text-brand" href="/saathi">Saathi</Link> and{" "}
              <Link className="font-semibold text-brand" href={`/karigar?k=${order.karigarId}`}>
                Karigar
              </Link>{" "}
              apps (open them in another tab).
            </p>
          )}
        </div>

        {(order.beforePhoto || order.afterPhoto) && (
          <div className="card">
            <h2 className="mb-3 font-bold">Photos</h2>
            <div className="grid grid-cols-2 gap-3">
              <Photo label="Before (from your quote)" file={order.beforePhoto} />
              <Photo label="After (karigar)" file={order.afterPhoto} />
            </div>
            {order.completionCheck && (
              <p className={`mt-3 rounded-xl p-3 text-sm ${order.completionCheck.passed ? "bg-brand-light text-brand-dark" : "bg-red-50 text-red-700"}`}>
                <b>AI completion check {order.completionCheck.passed ? "passed" : "failed"}</b> ({order.completionCheck.source}): {order.completionCheck.reasoning}
              </p>
            )}
          </div>
        )}
        {quote && quote.newPrice > 0 && captured && (
          <div className="card bg-accent-light text-sm">
            You saved about <b>{money(Math.max(0, quote.newPrice - order.repairCharge))}</b> by repairing instead of buying a new {quote.item.toLowerCase()}.
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-4">
        <div className="card space-y-2 text-sm">
          <h2 className="font-bold">Payment (PayPal {order.paypal.mode})</h2>
          <Breakdown order={order} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <Ref k="PayPal order" v={order.paypal.orderId} />
            <Ref k="Authorization (hold)" v={order.paypal.authorizationId} />
            <Ref k="Capture" v={order.paypal.captureId} />
            <Ref k="Payout batch" v={order.paypal.payoutBatchId} />
            <Ref k="Invoice" v={order.paypal.invoiceId} />
            {order.paypal.refunds.map((r) => (
              <Ref key={r.id} k={`Refund ${money(r.amount)}`} v={`${r.id} (${r.status})`} />
            ))}
          </dl>
          {order.paypal.invoiceUrl && (
            <a className="btn-outline w-full" href={order.paypal.invoiceUrl} target="_blank" rel="noreferrer">
              View PayPal invoice (digital bill)
            </a>
          )}
          {order.payouts.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-3 text-xs">
              <p className="mb-1 font-semibold">Instant split</p>
              {order.payouts.map((p) => (
                <p key={p.to} className="flex justify-between">
                  <span className="capitalize">{p.to}</span>
                  <span>
                    {money(p.amount)} · {p.status}
                  </span>
                </p>
              ))}
              <p className="flex justify-between">
                <span>Sudhaar</span>
                <span>{money(order.split.platform)}</span>
              </p>
              {order.donation > 0 && (
                <p className="flex justify-between">
                  <span>Karigar tool fund</span>
                  <span>{money(order.donation)}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {captured && <ResolveHub order={order} refunded={refunded} onChange={load} />}

        <div className="card">
          <h2 className="mb-3 font-bold">Activity & PayPal log</h2>
          <EventLog events={order.events} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

function Breakdown({ order }: { order: Order }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="flex justify-between">
        <span>Repair</span>
        <span>{money(order.repairCharge)}</span>
      </p>
      <p className="flex justify-between">
        <span>{order.mode === "pickup" ? `Pickup & delivery (${order.distanceKm} km)` : "Home visit"}</span>
        <span>{money(order.pickupFee)}</span>
      </p>
      {order.donation > 0 && (
        <p className="flex justify-between">
          <span>Karigar tool fund</span>
          <span>{money(order.donation)}</span>
        </p>
      )}
      <p className="flex justify-between border-t border-line pt-1 font-bold">
        <span>Total</span>
        <span>{money(order.total)}</span>
      </p>
    </div>
  );
}

function Ref({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="break-all font-mono">{v}</dd>
    </>
  );
}

function OtpCard({ label, otp, active, hint }: { label: string; otp: string; active: boolean; hint: string }) {
  return (
    <div className={`card text-center ${active ? "border-brand ring-2 ring-brand/20" : "opacity-60"}`}>
      <p className="label">{label}</p>
      <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-brand-dark">{otp}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function Photo({ label, file }: { label: string; file?: string }) {
  return (
    <figure>
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${file}`} alt={label} className="aspect-square w-full rounded-xl object-cover" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-gray-100 text-xs text-muted">No photo</div>
      )}
      <figcaption className="mt-1 text-xs text-muted">{label}</figcaption>
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

  async function resolve(c: Complaint, action: "refund" | "re_repair" | "rejected", amount?: number) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/resolve`, { complaintId: c.id, action, amount });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-bold">Resolve Hub</h2>
        <p className="text-xs text-muted">15-day repair warranty. Your PayPal invoice is attached automatically as proof.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ISSUES.map((i) => (
          <button key={i.id} onClick={() => setIssue(i.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${issue === i.id ? "border-brand bg-brand text-white" : "border-line"}`}>
            {i.label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-dashed border-line bg-gray-50 p-3 text-xs">
        <p className="font-semibold">Bill attached automatically</p>
        <p>
          PayPal invoice <span className="font-mono">{order.paypal.invoiceId ?? "pending"}</span> · capture <span className="font-mono">{order.paypal.captureId}</span> · paid{" "}
          {money(order.total)}
          {refunded > 0 && ` · refunded ${money(refunded)}`}
        </p>
      </div>
      <textarea className="input min-h-16" placeholder="What happened?" value={details} onChange={(e) => setDetails(e.target.value)} />
      <PhotoPicker compact label="Add a photo (optional)" onUploaded={(f) => setPhoto(f)} />
      <button className="btn w-full" disabled={busy || !details.trim()} onClick={submit}>
        {busy ? "AI is reviewing…" : "Submit complaint"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {order.complaints.map((c) => (
        <div key={c.id} className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <p className="font-semibold">
            {ISSUES.find((i) => i.id === c.issue)?.label} <span className="font-mono text-xs text-muted">{c.id}</span>
          </p>
          <p className="text-muted">{c.details}</p>
          {c.ai && (
            <p className="rounded-lg bg-brand-light p-2 text-xs text-brand-dark">
              <b>
                AI recommends {c.ai.recommendation.replaceAll("_", " ")}
                {c.ai.refundAmount ? ` of ${money(c.ai.refundAmount)}` : ""}
              </b>{" "}
              ({c.ai.source}): {c.ai.reasoning}
            </p>
          )}
          {c.resolution ? (
            <p className="text-xs font-semibold text-brand-dark">
              Resolved: {c.resolution.action.replaceAll("_", " ")}
              {c.resolution.amount ? ` ${money(c.resolution.amount)}` : ""} {c.resolution.refundId && <span className="font-mono">({c.resolution.refundId})</span>}
            </p>
          ) : (
            <div className="space-y-1 rounded-lg bg-gray-50 p-2">
              <p className="text-[11px] font-semibold uppercase text-muted">Support desk (admin)</p>
              <div className="flex flex-wrap gap-1.5">
                {c.ai && c.ai.refundAmount > 0 && (
                  <button className="btn px-3 py-1.5 text-xs" disabled={busy} onClick={() => resolve(c, "refund", c.ai!.refundAmount)}>
                    Approve PayPal refund {money(c.ai.refundAmount)}
                  </button>
                )}
                <button className="btn-outline px-3 py-1.5 text-xs" disabled={busy} onClick={() => resolve(c, "re_repair")}>
                  Free re-repair
                </button>
                <button className="btn-outline px-3 py-1.5 text-xs" disabled={busy} onClick={() => resolve(c, "rejected")}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
