"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { rupees } from "@/components/Inr";
import { useLang } from "@/components/LanguageProvider";
import { EarningsList, PartnerHeader, PayoutCheck, StatStrip, TabsN, usePartner, WeekChart, type PartnerData } from "@/components/partner/PartnerHome";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SlotLine } from "@/components/SlotLine";
import { ResendOtp } from "@/components/partner/ResendOtp";
import { ClaimCard } from "@/components/resolve/Claims";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrders } from "@/components/useOrders";
import { isOpenClaim } from "@/lib/claims-shared";
import { INR_PER_USD } from "@/lib/pricing";
import { langMeta } from "@/lib/i18n";
import type { CompletionCheck, Job, Order } from "@/lib/types";

// The Karigar app: only this karigar's jobs (the API filters them), price changes after
// inspection, the AI photo check, online/offline, and earnings from real PayPal payouts.
export default function KarigarApp() {
  const { t } = useLang();
  const { orders, reload } = useOrders();
  const partner = usePartner("karigar");
  const [tab, setTab] = useState("jobs");
  useEffect(() => {
    if (window.location.hash === "#claims") setTab("claims");
  }, []);
  const kid = partner.data?.profile.id;
  if (partner.error) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-destructive">{partner.error}</p>;
  if (!partner.data || !kid) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-muted-foreground">…</p>;
  const d = partner.data;

  const mine = orders.filter((o) => (o.kind === "basket" ? o.jobs?.some((j) => j.karigarId === kid) : o.karigarId === kid));
  const active = mine.filter((o) => ["authorized", "picked_up", "at_karigar", "repairing", "repaired"].includes(o.status));
  const done = mine.filter((o) => ["out_for_delivery", "delivered", "paid_out"].includes(o.status)).slice(0, 8);
  // Resolve Hub claims on this karigar's repairs: they can reply and add photos.
  const claims = mine.flatMap((o) => o.complaints.map((c) => ({ order: o, claim: c }))).sort((a, b) => b.claim.createdAt.localeCompare(a.claim.createdAt));
  const openClaims = claims.filter((x) => isOpenClaim(x.claim)).length;
  const refresh = () => {
    reload();
    partner.reload();
  };
  // The job board: what's coming, what's on the bench, what's ready to go back.
  const stages: { key: string; title: string; hint: string; list: Order[] }[] = [
    { key: "coming", title: t("kbComing"), hint: t("kbComingHint"), list: active.filter((o) => ["authorized", "picked_up"].includes(o.status) && !(o.mode === "home-visit" && o.status === "authorized")) },
    { key: "bench", title: t("kbBench"), hint: t("kbBenchHint"), list: active.filter((o) => ["at_karigar", "repairing"].includes(o.status) || (o.mode === "home-visit" && o.status === "authorized")) },
    { key: "ready", title: t("kbReady"), hint: t("kbReadyHint"), list: active.filter((o) => o.status === "repaired") },
  ];
  const card = (o: Order) => (o.kind === "basket" ? <BasketJobs key={o.id} order={o} karigarId={kid} canPrice={!partner.isAdmin} onDone={refresh} /> : <KarigarJob key={o.id} order={o} canPrice={!partner.isAdmin} onDone={refresh} />);

  return (
    <div className="space-y-4">
      <PartnerHeader data={d} isAdmin={partner.isAdmin} viewAs={partner.viewAs} setViewAs={partner.setViewAs} onChange={partner.reload} />
      <StatStrip
        items={[
          { label: t("kaEarned"), value: rupees(d.totalEarned), sub: `$${d.totalEarned.toFixed(2)} · PayPal`, tone: "text-teal" },
          { label: t("ptThisWeek"), value: rupees(d.stats.weekTotal) },
          { label: t("kaJobs"), value: String(active.length) },
          { label: t("ptDone"), value: String(d.stats.finished), sub: t("kbAllTime", { n: d.profile.jobsDone ?? 0 }) },
          { label: t("ptRating"), value: d.stats.avgStars ? `★ ${d.stats.avgStars}` : `★ ${d.profile.rating}`, sub: t("kbReviewsN", { n: d.reviews.length }) },
          { label: t("ptTips"), value: rupees(d.stats.tips) },
        ]}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4">
          <TabsN
            value={tab}
            onChange={setTab}
            items={[
              ["jobs", `${t("kaJobs")} (${active.length})`],
              ["earnings", t("kaHistory")],
              ["claims", `${t("kbClaims")}${openClaims ? ` (${openClaims})` : ""}`],
              ["reviews", `${t("kbReviews")} (${d.reviews.length})`],
              ["shop", t("kbShop")],
            ]}
          />
          {tab === "jobs" && (
            <div className="space-y-5">
              {active.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("kaNoJobs")}</p>}
              {stages
                .filter((st) => st.list.length > 0)
                .map((st) => (
                  <div key={st.key} className="space-y-2">
                    <p className="flex items-baseline gap-2 text-sm font-semibold">
                      {st.title} <span className="rounded-full bg-muted px-2 text-xs">{st.list.length}</span>
                      <span className="text-xs font-normal text-muted-foreground">{st.hint}</span>
                    </p>
                    <div className="grid gap-3 xl:grid-cols-2">{st.list.map(card)}</div>
                  </div>
                ))}
              {done.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{t("kbDone")}</p>
                  <div className="paper divide-y divide-border rounded-2xl px-4">
                    {done.map((o) => {
                      const r = o.ratings?.find((x) => x.karigarId === kid);
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{o.kind === "basket" ? t("kaBasket", { n: o.jobs?.filter((j) => j.karigarId === kid).length ?? 0 }) : o.item}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{o.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {r && <span className="text-xs font-semibold text-gold">★ {r.stars}</span>}
                            <StatusPill status={o.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "earnings" && (
            <div className="space-y-3">
              <PayoutCheck onDone={partner.reload} />
              <EarningsList data={d} />
            </div>
          )}
          {tab === "claims" && (
            <div id="claims" className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("kbClaimsHint")}</p>
              {claims.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("kbNoClaims")}</p>}
              {claims.map(({ order, claim }) => (
                <ClaimCard key={claim.id} order={order} claim={claim} />
              ))}
            </div>
          )}
          {tab === "reviews" && <Reviews data={d} />}
          {tab === "shop" && <ShopEditor data={d} disabled={partner.isAdmin} onSaved={partner.reload} />}
        </section>
        <aside className="space-y-4">
          <WeekChart week={d.week} />
          <div className="paper space-y-2 rounded-2xl p-4 text-xs">
            <p className="text-sm font-semibold">{t("kbHowPaid")}</p>
            <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>{t("kbPaid1")}</li>
              <li>{t("kbPaid2")}</li>
              <li>{t("kbPaid3")}</li>
              <li>{t("kbPaid4")}</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Reviews({ data }: { data: PartnerData }) {
  const { t, lang } = useLang();
  if (data.reviews.length === 0) return <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("kbNoReviews")}</p>;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {data.reviews.map((r) => (
        <div key={`${r.orderId}-${r.at}`} className="paper space-y-1.5 rounded-2xl p-4">
          <p className="flex items-center justify-between text-sm">
            <span className="font-semibold">{r.by}</span>
            <span className="text-gold">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
          </p>
          {r.text && <p className="text-sm text-muted-foreground">“{r.text}”</p>}
          <p className="text-[11px] text-muted-foreground">
            {r.item} · <span className="font-mono">{r.orderId}</span> · {new Date(r.at).toLocaleDateString(langMeta(lang).locale)} · {t("kbVerified")}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The karigar's own rate card, bio and usual turnaround, shown on their public profile. */
function ShopEditor({ data, disabled, onSaved }: { data: PartnerData; disabled: boolean; onSaved: () => void }) {
  const { t } = useLang();
  const [bio, setBio] = useState(data.profile.bio ?? "");
  const [days, setDays] = useState(String(data.profile.turnaroundDays ?? 1));
  const [services, setServices] = useState((data.profile.services ?? []).map((s) => ({ name: s.name, priceInr: String(Math.round(s.price * INR_PER_USD)) })));
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, k: "name" | "priceInr", v: string) => setServices((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: k === "priceInr" ? v.replace(/\D/g, "") : v } : x)));
  return (
    <div className="paper max-w-2xl space-y-4 rounded-2xl p-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("kbRateCard")}</p>
        {services.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input value={s.name} onChange={(e) => set(i, "name", e.target.value)} disabled={disabled} aria-label={t("kbService")} />
            <div className="relative w-32 shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input className="pl-7" inputMode="numeric" value={s.priceInr} onChange={(e) => set(i, "priceInr", e.target.value)} disabled={disabled} aria-label={t("kbPrice")} />
            </div>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setServices((xs) => xs.filter((_, j) => j !== i))} aria-label={t("kbRemove")}>
              ×
            </Button>
          </div>
        ))}
        {services.length < 8 && (
          <button disabled={disabled} className="text-xs font-semibold text-primary underline" onClick={() => setServices((xs) => [...xs, { name: "", priceInr: "" }])}>
            {t("kbAddService")}
          </button>
        )}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">{t("kbBio")}</span>
        <Input value={bio} onChange={(e) => setBio(e.target.value)} disabled={disabled} />
      </label>
      <label className="block w-48 space-y-1 text-sm">
        <span className="font-semibold">{t("kbTurnaround")}</span>
        <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 2))} disabled={disabled} />
      </label>
      <Button
        disabled={disabled}
        onClick={() =>
          api("/api/partner/profile", { bio, turnaroundDays: Number(days), services })
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
      <p className="text-[11px] text-muted-foreground">{t("kbShopNote")}</p>
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
          {visit && order.status === "authorized" && <SlotLine order={order} className="mt-1" />}
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
          {visit && <ResendOtp orderId={order.id} />}
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
          <ResendOtp orderId={order.id} />
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
