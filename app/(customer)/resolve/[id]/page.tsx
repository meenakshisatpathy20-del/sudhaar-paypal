"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, CreditCard, Gavel, Phone, ShieldCheck, Undo2, UserRound, Wrench } from "lucide-react";
import { RequireLogin } from "@/components/LoginSheet";
import { useLang } from "@/components/LanguageProvider";
import { useSession } from "@/components/SessionProvider";
import { ActivityLog, claimItem, Conversation, EvidenceCard, PriorityBadge, SlaBadge, StageProgress, StatusBadge, useWhen } from "@/components/resolve/Claims";
import { api, money } from "@/components/api";
import { rupees } from "@/components/Inr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { CLAIM_PRIORITIES, claimStatusOf, isOpenClaim, priorityOf } from "@/lib/claims-shared";
import { cn } from "@/lib/utils";
import type { ClaimStatus, Complaint, Order } from "@/lib/types";

type ClaimData = { claim: Complaint; order: Order; team?: { id: string; name: string }[]; warrantyDaysLeft: number };

export default function ClaimPage() {
  return (
    <RequireLogin roles={["customer", "karigar", "admin"]}>
      <Claim />
    </RequireLogin>
  );
}

// One Resolve Hub claim: status and stage, the deadline, the evidence, the conversation and the
// activity log. The customer and karigar can reply and add photos; the Sudhaar team runs the case.
function Claim() {
  const { t } = useLang();
  const when = useWhen();
  const { account } = useSession();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClaimData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch(`/api/claims/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Claim not found");
        setData(j);
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);

  if (error && !data)
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-2">
          <p className="font-semibold">{error}</p>
          <Link href="/resolve" className="text-sm font-semibold text-primary underline">
            ← Resolve Hub
          </Link>
        </CardContent>
      </Card>
    );
  if (!data || !account) return <Card className="h-64 animate-pulse" />;
  const { claim: c, order: o } = data;
  const me = account.role as "customer" | "karigar" | "admin";
  const open = isOpenClaim(c);
  const back = me === "admin" ? "/admin?tab=resolve" : me === "karigar" ? "/karigar#claims" : "/resolve";

  return (
    <div className="space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {me === "admin" ? "Claims desk" : "Resolve Hub"}
      </Link>

      <section className="paper space-y-4 rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm text-muted-foreground">{c.id}</p>
            <h1 className="font-display text-2xl font-bold md:text-3xl">
              {t(`oIssue_${c.issue}` as never)} · {claimItem(o, t)}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("rhRaisedOn", { date: when(c.createdAt) })}
              {c.channel === "phone" && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Phone className="size-3" /> {t("rhViaPhone")}
                </span>
              )}
              {c.channel === "agent" && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Bot className="size-3" /> {t("rhViaAgent")}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge p={priorityOf(c)} />
            <SlaBadge c={c} />
            <StatusBadge c={c} />
          </div>
        </div>
        <StageProgress c={c} />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section className="paper space-y-3 rounded-2xl p-4">
            <h2 className="font-bold">{t("rhWhatHappened")}</h2>
            <p className="whitespace-pre-wrap text-sm">{c.details}</p>
            {c.ai && (
              <div className="rounded-xl bg-primary/10 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Bot className="size-4 text-primary" /> {t("oAiRecommends")} {t(`oRec_${c.ai.recommendation}` as never)}
                  {c.ai.refundAmount ? ` ${rupees(c.ai.refundAmount)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.ai.reasoning} ({c.ai.source === "simulated" ? t("oBySim") : t("oByAi")})
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("rhAiNote")}</p>
              </div>
            )}
            {c.resolution && <Decision c={c} />}
          </section>
          <Conversation claim={c} me={me} onSent={load} />
          <EvidenceCard claim={c} canAdd={open && me !== "admin"} onAdded={load} />
          <ActivityLog claim={c} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          {me === "admin" && <ActionPanel data={data} onDone={load} />}
          {me === "customer" && open && <Withdraw claim={c} onDone={load} />}
          <Parties order={o} claim={c} me={me} warrantyLeft={data.warrantyDaysLeft} />
        </aside>
      </div>
    </div>
  );
}

function Decision({ c }: { c: Complaint }) {
  const { t } = useLang();
  const when = useWhen();
  const r = c.resolution!;
  return (
    <div className={cn("rounded-xl p-3 text-sm ring-1", r.action === "rejected" ? "bg-muted ring-border" : "bg-teal/10 ring-teal/30")}>
      <p className="flex items-center gap-1.5 font-semibold">
        <Gavel className="size-4 text-teal" /> {t("oResolved")} {t(`oRes_${r.action}` as never)}
        {r.amount ? ` ${rupees(r.amount)}` : ""}
      </p>
      {r.remarks && <p className="text-xs">{r.remarks}</p>}
      {r.refundId && (
        <p className="text-xs text-muted-foreground">
          {t("rhRefundId")} <span className="font-mono">{r.refundId}</span>
        </p>
      )}
      {r.action === "re_repair" && <p className="text-xs text-muted-foreground">{t("rhReRepairNote")}</p>}
      <p className="text-[11px] text-muted-foreground">{when(r.at)}</p>
    </div>
  );
}

function Withdraw({ claim: c, onDone }: { claim: Complaint; onDone: () => void }) {
  const { t } = useLang();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api(`/api/claims/${c.id}`, { action: "withdraw" });
      onDone();
    } finally {
      setBusy(false);
      setAsk(false);
    }
  }
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-sm font-semibold">{t("rhSolved")}</p>
        <p className="text-xs text-muted-foreground">{t("rhWithdrawHelp")}</p>
        {ask ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAsk(false)}>
              {t("rhCancel")}
            </Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={go}>
              {t("rhWithdrawConfirm")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAsk(true)}>
            <Undo2 /> {t("rhWithdraw")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** The repair, the people on it and the PayPal ids behind the money. */
function Parties({ order: o, claim: c, me, warrantyLeft }: { order: Order; claim: Complaint; me: string; warrantyLeft: number }) {
  const { t } = useLang();
  const refunded = o.paypal.refunds.reduce((s, r) => s + r.amount, 0);
  const rows: [string, React.ReactNode][] = [
    [t("rhOrder"), me === "karigar" ? <span className="font-mono">{o.id}</span> : <Link href={`/orders/${o.id}`} className="font-mono text-primary underline">{o.id}</Link>],
    [t("rhCustomer"), me === "admin" ? o.customer.name : o.customer.name.split(" ")[0]],
    [t("rhPaid"), money(o.total)],
    ...(refunded > 0 ? ([[t("oRefunded"), money(refunded)]] as [string, React.ReactNode][]) : []),
    [t("rhWarranty"), warrantyLeft >= 0 ? t("rhDaysLeft", { n: warrantyLeft }) : t("rhWarrantyOver")],
    ["Invoice", <span key="i" className="font-mono">{o.paypal.invoiceId ?? "—"}</span>],
    ["Capture", <span key="c" className="font-mono">{o.paypal.captureId ?? "—"}</span>],
  ];
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4 text-teal" /> {t("rhDetails")}
        </h2>
        <dl className="space-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-1.5 border-t border-border pt-3 text-xs">
          <p className="flex items-center gap-2">
            <UserRound className="size-3.5 text-primary" /> {t("rhPeopleCustomer")}
          </p>
          <p className="flex items-center gap-2">
            <Wrench className="size-3.5 text-violet-600" /> {t("rhPeopleKarigar")}
          </p>
          <p className="flex items-center gap-2">
            <Gavel className="size-3.5 text-teal" /> {c.assignedTo ? t("rhHandledBy", { name: c.assignedTo.name }) : t("rhPeopleTeam")}
          </p>
          <p className="flex items-center gap-2">
            <CreditCard className="size-3.5 text-[#003087]" /> {t("rhPeoplePayPal")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const STAFF_STATUSES: ClaimStatus[] = ["in_review", "awaiting_customer", "awaiting_karigar"];

/** Sudhaar team controls, like a support desk: status with remarks, owner, priority, decision, reopen. */
function ActionPanel({ data, onDone }: { data: ClaimData; onDone: () => void }) {
  const { claim: c, order: o, team = [] } = data;
  const status = claimStatusOf(c);
  const open = isOpenClaim(c);
  const refunded = o.paypal.refunds.reduce((s, r) => s + r.amount, 0);
  const [next, setNext] = useState<ClaimStatus>(STAFF_STATUSES.includes(status) ? status : "in_review");
  const [remarks, setRemarks] = useState("");
  const [amount, setAmount] = useState(String(c.ai?.refundAmount || Math.min(o.repairCharge, o.total - refunded).toFixed(2)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(body: object, clear = true) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/claims/${c.id}`, body);
      if (clear) setRemarks("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const select = "h-9 w-full rounded-xl border border-border bg-card px-2 text-sm";
  return (
    <Card className="ring-1 ring-primary/30">
      <CardContent className="space-y-4">
        <h2 className="flex items-center gap-2 font-bold">
          <Gavel className="size-4 text-primary" /> Team actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-semibold">
            Handled by
            <select className={select} value={c.assignedTo?.id ?? ""} disabled={busy} onChange={(e) => act({ action: "assign", to: e.target.value }, false)}>
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Priority
            <select className={select} value={priorityOf(c)} disabled={busy} onChange={(e) => act({ action: "priority", priority: e.target.value }, false)}>
              {CLAIM_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (shown to the customer and karigar in the conversation)" maxLength={500} />

        {open ? (
          <>
            <div className="space-y-2 rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold">Move the case</p>
              <div className="flex gap-2">
                <select className={select} value={next} onChange={(e) => setNext(e.target.value as ClaimStatus)}>
                  {STAFF_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" disabled={busy || next === status} onClick={() => act({ action: "status", status: next, remarks })}>
                  Update
                </Button>
              </div>
            </div>
            <div className="space-y-2 rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold">Decide (closes the claim)</p>
              <div className="flex items-center gap-2">
                <span className="text-sm">$</span>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="h-9" />
                <Button size="sm" disabled={busy || !(Number(amount) > 0)} onClick={() => act({ action: "decide", decision: "refund", amount: Number(amount), remarks })}>
                  PayPal refund
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paid {money(o.total)}
                {refunded > 0 && `, already refunded ${money(refunded)}`}. AI suggested {c.ai?.refundAmount ? money(c.ai.refundAmount) : "no refund"}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: "decide", decision: "re_repair", remarks })}>
                  Free re-repair
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ action: "decide", decision: "rejected", remarks })}>
                  Close without refund
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={busy || c.resolution?.action === "refund"} onClick={() => act({ action: "reopen", remarks })}>
            Reopen claim
          </Button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
