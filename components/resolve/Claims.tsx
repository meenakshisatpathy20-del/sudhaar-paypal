"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, CheckCircle2, Circle, Receipt, UserCheck } from "lucide-react";
import { langMeta } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Complaint, Order } from "@/lib/types";
import { api, money } from "../api";
import { rupees } from "../Inr";
import { useLang } from "../LanguageProvider";
import { PhotoPicker } from "../PhotoPicker";
import { Button } from "../ui/button";
import { Textarea } from "../ui/input";

export const ISSUES: Complaint["issue"][] = ["repair_failed", "damaged", "overcharged", "delayed", "missing"];

/** Short status for a claim: under review, re-repair, refunded or closed. */
export function claimStatus(c: Complaint, t: ReturnType<typeof useLang>["t"]): { label: string; tone: string } {
  if (!c.resolution) return { label: t("rhUnderReview"), tone: "bg-marigold/20 text-[#7a4a06]" };
  if (c.resolution.action === "refund") return { label: t("rhRefunded", { amount: rupees(c.resolution.amount ?? 0) }), tone: "bg-teal/15 text-teal" };
  if (c.resolution.action === "re_repair") return { label: t("rhReRepair"), tone: "bg-teal/15 text-teal" };
  return { label: t("rhClosed"), tone: "bg-muted text-muted-foreground" };
}

/** Raise a warranty claim on one delivered order. The PayPal invoice is attached automatically. */
export function ClaimForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useLang();
  const [issue, setIssue] = useState<Complaint["issue"]>("repair_failed");
  const [details, setDetails] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refunded = order.paypal.refunds.reduce((s, r) => s + r.amount, 0);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/complaint`, { issue, details, photo });
      setDetails("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t("oWhatWrong")}</p>
      <div className="flex flex-wrap gap-1.5">
        {ISSUES.map((i) => (
          <button key={i} onClick={() => setIssue(i)} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", issue === i ? "bg-primary text-primary-foreground ring-primary" : "ring-border hover:bg-muted")}>
            {t(`oIssue_${i}`)}
          </button>
        ))}
      </div>
      <Textarea placeholder={t("oTellUs")} value={details} onChange={(e) => setDetails(e.target.value)} />
      <PhotoPicker compact label={t("oAddPhoto")} onUploaded={(f) => setPhoto(f)} />
      <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-semibold">
          <Receipt className="size-3.5 text-primary" /> {t("oBillAttached")}
        </p>
        <p className="text-muted-foreground">
          Invoice <span className="font-mono">{order.paypal.invoiceId ?? "pending"}</span> · capture <span className="font-mono">{order.paypal.captureId}</span> · {t("oPaid")} {money(order.total)}
          {refunded > 0 && ` · ${t("oRefunded")} ${money(refunded)}`}
        </p>
      </div>
      <Button size="lg" className="w-full" disabled={busy || details.trim().length < 5} onClick={submit}>
        {busy ? t("oReviewing") : t("oSubmit")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** A claim from start to finish: raised → AI review → decision by a person → PayPal refund. */
export function ClaimTimeline({ order, complaint: c }: { order: Order; complaint: Complaint }) {
  const { t, lang } = useLang();
  const time = (iso: string) => new Date(iso).toLocaleString(langMeta(lang).locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const st = claimStatus(c, t);
  const steps: { done: boolean; icon: typeof Bot; title: string; body?: React.ReactNode; at?: string }[] = [
    { done: true, icon: CheckCircle2, title: t("rhStepRaised", { issue: t(`oIssue_${c.issue}`) }), body: <>&ldquo;{c.details}&rdquo;</>, at: c.createdAt },
    {
      done: Boolean(c.ai),
      icon: Bot,
      title: c.ai ? `${t("oAiRecommends")} ${t(`oRec_${c.ai.recommendation}`)}${c.ai.refundAmount ? ` ${rupees(c.ai.refundAmount)}` : ""}` : t("rhStepAi"),
      body: c.ai && (
        <>
          {c.ai.reasoning} <span className="text-muted-foreground">({c.ai.source === "simulated" ? t("oBySim") : t("oByAi")})</span>
        </>
      ),
    },
    {
      done: Boolean(c.resolution),
      icon: UserCheck,
      title: c.resolution ? `${t("oResolved")} ${t(`oRes_${c.resolution.action}`)}${c.resolution.amount ? ` ${rupees(c.resolution.amount)}` : ""}` : t("rhStepTeam"),
      body: c.resolution?.refundId ? (
        <>
          {t("rhRefundId")} <span className="font-mono">{c.resolution.refundId}</span>
        </>
      ) : c.resolution ? undefined : (
        t("oSupportReviewing")
      ),
      at: c.resolution?.at,
    },
  ];
  return (
    <div className="paper space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{order.kind === "basket" && order.jobs ? t("oBasketTitle", { n: order.jobs.length }) : order.item}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{c.id}</span> ·{" "}
            <Link href={`/orders/${order.id}`} className="font-mono text-primary underline">
              {order.id}
            </Link>
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
      </div>
      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              {s.done ? <s.icon className="size-5 text-teal" /> : <Circle className="size-5 text-muted-foreground/40" />}
              {i < steps.length - 1 && <span className={cn("my-0.5 w-px flex-1", s.done ? "bg-teal/40" : "bg-border")} />}
            </div>
            <div className="pb-3 text-sm">
              <p className={cn(s.done ? "font-semibold" : "text-muted-foreground")}>{s.title}</p>
              {s.body && <p className="text-xs text-muted-foreground">{s.body}</p>}
              {s.at && <p className="text-[11px] text-muted-foreground">{time(s.at)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
