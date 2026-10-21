"use client";

import { useState } from "react";
import { api } from "@/components/api";
import { rupees } from "@/components/Inr";
import { useLang } from "@/components/LanguageProvider";
import { EarningsList, PartnerHeader, Tabs2, usePartner } from "@/components/partner/PartnerHome";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrders } from "@/components/useOrders";
import { INR_PER_USD } from "@/lib/pricing";
import type { CompletionCheck, Job, Order } from "@/lib/types";

// The Karigar app: only this karigar's jobs (the API filters them), price changes after
// inspection, the AI photo check, online/offline, and earnings from real PayPal payouts.
export default function KarigarApp() {
  const { t } = useLang();
  const { orders, reload } = useOrders();
  const partner = usePartner("karigar");
  const [tab, setTab] = useState("jobs");
  const kid = partner.data?.profile.id;
  if (partner.error) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-destructive">{partner.error}</p>;
  if (!partner.data || !kid) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-muted-foreground">…</p>;

  const mine = orders.filter((o) => (o.kind === "basket" ? o.jobs?.some((j) => j.karigarId === kid) : o.karigarId === kid));
  const active = mine.filter((o) => ["authorized", "picked_up", "at_karigar", "repairing", "repaired"].includes(o.status));
  const refresh = () => {
    reload();
    partner.reload();
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PartnerHeader data={partner.data} isAdmin={partner.isAdmin} viewAs={partner.viewAs} setViewAs={partner.setViewAs} onChange={partner.reload} />
      <Tabs2 value={tab} onChange={setTab} items={[["jobs", `${t("kaJobs")} (${active.length})`], ["earnings", t("kaHistory")]]} />
      {tab === "earnings" ? (
        <EarningsList data={partner.data} />
      ) : (
        <>
          {active.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("kaNoJobs")}</p>}
          {active.map((o) => (o.kind === "basket" ? <BasketJobs key={o.id} order={o} karigarId={kid} canPrice={!partner.isAdmin} onDone={refresh} /> : <KarigarJob key={o.id} order={o} canPrice={!partner.isAdmin} onDone={refresh} />))}
        </>
      )}
    </div>
  );
}

async function post(url: string, body: object, setBusy: (v: boolean) => void, setError: (e: string | null) => void, onDone: () => void) {
  setBusy(true);
  setError(null);
  try {
    await api(url, body);
    onDone();
  } catch (e) {
    setError((e as Error).message);
  } finally {
    setBusy(false);
  }
}

function KarigarJob({ order, canPrice, onDone }: { order: Order; canPrice: boolean; onDone: () => void }) {
  const { t } = useLang();
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (action: string, extra: object = {}) => post(`/api/orders/${order.id}/action`, { action, ...extra }, setBusy, setError, onDone);

  const visit = order.mode === "home-visit";
  const inspecting = order.status === "at_karigar" || order.status === "repairing" || (visit && order.status === "authorized");
  const waitingOnCustomer = order.priceChange && ["pending", "awaiting_payment"].includes(order.priceChange.status);
  return (
    <div className="paper space-y-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
          <p className="font-semibold">{order.item}</p>
          <p className="text-xs text-muted-foreground">
            {order.issue} · {rupees(order.repairCharge)} · {t("kaYouEarn", { amount: rupees(visit ? order.split.karigar + order.split.saathi : order.split.karigar) })}
          </p>
          {visit && <p className="text-xs text-muted-foreground">📍 {order.customer.address}</p>}
        </div>
        <StatusPill status={order.status} />
      </div>
      {order.beforePhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${order.beforePhoto}`} alt="" className="h-28 w-full rounded-xl object-cover ring-1 ring-border" />
      )}
      {order.status === "authorized" && !visit && <p className="text-xs text-muted-foreground">{t("kaWaitSaathi")}</p>}
      {order.status === "picked_up" && <p className="text-xs text-muted-foreground">{t("kaSaathiComing")}</p>}
      <PriceStatus order={order} />
      {inspecting && canPrice && !waitingOnCustomer && <PriceChangeForm order={order} onDone={onDone} />}
      {(order.status === "at_karigar" || (visit && order.status === "authorized")) && (
        <>
          {visit && <OtpInput placeholder={t("kaArrivalOtp")} value={otp} onChange={setOtp} />}
          <Button className="w-full" disabled={busy || (visit && otp.length !== 4)} onClick={() => run("start_repair", { otp })}>
            {visit ? t("kaStartVisit") : t("kaStart")}
          </Button>
        </>
      )}
      {order.status === "repairing" && (
        <>
          {order.completionCheck && !order.completionCheck.passed && <CheckNote check={order.completionCheck} />}
          <PhotoPicker compact label={t("kaAfterPhoto")} onUploaded={(f) => setPhoto(f)} />
          <Button className="w-full" disabled={busy || !photo || Boolean(waitingOnCustomer)} onClick={() => run("mark_repaired", { afterPhoto: photo })}>
            {busy ? t("kaChecking") : t("kaMarkRepaired")}
          </Button>
        </>
      )}
      {order.status === "repaired" && !visit && <p className="text-xs text-muted-foreground">{t("kaReady")}</p>}
      {order.status === "repaired" && visit && (
        <>
          <OtpInput placeholder={t("kaJobDoneOtp")} value={otp} onChange={setOtp} />
          <Button className="w-full" disabled={busy || otp.length !== 4} onClick={() => run("deliver", { otp })}>
            {busy ? t("kaCapturing") : t("kaGetPaid")}
          </Button>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Ghar Safai basket: this karigar only sees and repairs their own items. */
function BasketJobs({ order, karigarId, canPrice, onDone }: { order: Order; karigarId: string; canPrice: boolean; onDone: () => void }) {
  const { t } = useLang();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobs = (order.jobs ?? []).filter((j) => j.karigarId === karigarId);
  const atKarigar = order.status === "at_karigar" || order.status === "repairing";
  const waitingOnCustomer = order.priceChange && ["pending", "awaiting_payment"].includes(order.priceChange.status);
  const run = (jobId: string, action: "start_repair" | "mark_repaired") =>
    post(`/api/orders/${order.id}/action`, { action, jobId, afterPhoto: photos[jobId] }, (v) => setBusy(v ? jobId : null), setError, onDone);

  return (
    <div className="paper space-y-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
          <p className="font-semibold">🪔 {t("kaBasket", { n: jobs.length })}</p>
        </div>
        <StatusPill status={order.status} />
      </div>
      {!atKarigar && order.status !== "repaired" && <p className="text-xs text-muted-foreground">{t("kaSaathiComing")}</p>}
      <PriceStatus order={order} />
      {jobs.map((j) => (
        <div key={j.id} className="space-y-2 rounded-xl bg-muted/50 p-3 ring-1 ring-border">
          <p className="flex justify-between gap-2 text-sm">
            <span className="font-semibold">{j.item}</span>
            <span className="text-xs text-muted-foreground">{t("kaYouEarn", { amount: rupees(j.price * 0.9) })}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {j.issue} · {rupees(j.price)}
          </p>
          {j.completionCheck && !j.completionCheck.passed && <CheckNote check={j.completionCheck} />}
          {atKarigar && j.status !== "repaired" && canPrice && !waitingOnCustomer && <PriceChangeForm order={order} job={j} onDone={onDone} />}
          {atKarigar && j.status === "waiting" && (
            <Button className="w-full" size="sm" disabled={busy === j.id} onClick={() => run(j.id, "start_repair")}>
              {t("kaStart")}
            </Button>
          )}
          {j.status === "repairing" && (
            <>
              <PhotoPicker compact label={t("kaAfterPhoto")} onUploaded={(f) => setPhotos((p) => ({ ...p, [j.id]: f }))} />
              <Button className="w-full" size="sm" disabled={busy === j.id || !photos[j.id] || (waitingOnCustomer && order.priceChange?.jobId === j.id)} onClick={() => run(j.id, "mark_repaired")}>
                {busy === j.id ? t("kaChecking") : t("kaMarkRepaired")}
              </Button>
            </>
          )}
          {j.status === "repaired" && <p className="text-xs font-semibold text-teal">{t("kaRepairedWait")}</p>}
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** After inspection the karigar can ask for a different price; the customer must approve it. */
function PriceChangeForm({ order, job, onDone }: { order: Order; job?: Job; onDone: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-primary underline">
        {t("kaChangePrice")}
      </button>
    );
  const usd = Math.round((Number(price) / INR_PER_USD) * 100) / 100;
  return (
    <div className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-border">
      <Input inputMode="numeric" placeholder={t("kaNewPrice")} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
      <Input placeholder={t("kaWhy")} value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button size="sm" className="w-full" disabled={busy || !price || !reason.trim()} onClick={() => post(`/api/orders/${order.id}/price`, { jobId: job?.id, newPrice: usd, reason }, setBusy, setError, onDone)}>
        {t("kaSendPrice")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PriceStatus({ order }: { order: Order }) {
  const { t } = useLang();
  const pc = order.priceChange;
  if (!pc) return null;
  const vars = { from: rupees(pc.from), to: rupees(pc.to) };
  const [tone, text] =
    pc.status === "pending"
      ? ["bg-marigold/15 text-[#7a4a06]", t("kaPricePending", vars)]
      : pc.status === "awaiting_payment"
        ? ["bg-marigold/15 text-[#7a4a06]", t("kaPricePay", vars)]
        : pc.status === "approved"
          ? ["bg-teal/10 text-teal", t("kaPriceApproved", vars)]
          : ["bg-muted text-muted-foreground", t("kaPriceDeclined", vars)];
  return (
    <p className={`rounded-lg p-2 text-xs ${tone}`}>
      {pc.item}: {text}
    </p>
  );
}

function OtpInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return <Input className="text-center font-mono tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />;
}

function CheckNote({ check }: { check: CompletionCheck }) {
  const { t } = useLang();
  return (
    <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
      {check.reasoning}
      {check.needsReview && ` ${t("kaCheckReview")}`}
    </p>
  );
}
