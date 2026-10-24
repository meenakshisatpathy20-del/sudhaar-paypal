"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Bot, Check, ChevronRight, Clock, FileSearch, Gavel, ImagePlus, Inbox, Lock, Receipt, X } from "lucide-react";
import { langMeta } from "@/lib/i18n";
import { CLAIM_STAGES, claimStage, claimStatusOf, DEFAULT_PRIORITY, isOpenClaim, MAX_EVIDENCE, priorityOf, slaDueOf } from "@/lib/claims-shared";
import { cn } from "@/lib/utils";
import type { ClaimPriority, ClaimStatus, Complaint, Order } from "@/lib/types";
import { api, money } from "../api";
import { rupees } from "../Inr";
import { useLang } from "../LanguageProvider";
import { PhotoPicker } from "../PhotoPicker";
import { Button } from "../ui/button";
import { Textarea } from "../ui/input";

type T = ReturnType<typeof useLang>["t"];

export const ISSUES: Complaint["issue"][] = ["repair_failed", "damaged", "missing", "overcharged", "delayed"];

const STATUS_TONE: Record<ClaimStatus, string> = {
  open: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  in_review: "bg-marigold/20 text-[#7a4a06] dark:text-marigold",
  awaiting_customer: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  awaiting_karigar: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  resolved: "bg-teal/15 text-teal",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};
const PRIORITY_TONE: Record<ClaimPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  high: "bg-marigold/25 text-[#7a4a06] dark:text-marigold",
  critical: "bg-destructive/15 text-destructive",
};

export const claimItem = (o: Order, t: T) => (o.kind === "basket" && o.jobs ? t("oBasketTitle", { n: o.jobs.length }) : o.item);

/** Short status for a claim; a resolved claim says how (refund amount or re-repair). */
export function claimStatus(c: Complaint, t: T): { label: string; tone: string } {
  const s = claimStatusOf(c);
  if (s === "resolved" && c.resolution?.action === "refund") return { label: t("rhRefunded", { amount: rupees(c.resolution.amount ?? 0) }), tone: STATUS_TONE.resolved };
  if (s === "resolved" && c.resolution?.action === "re_repair") return { label: t("rhReRepair"), tone: STATUS_TONE.resolved };
  return { label: t(`rhSt_${s}` as never), tone: STATUS_TONE[s] };
}

export function StatusBadge({ c }: { c: Complaint }) {
  const { t } = useLang();
  const st = claimStatus(c, t);
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>;
}

export function PriorityBadge({ p }: { p: ClaimPriority }) {
  const { t } = useLang();
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIORITY_TONE[p])}>{t(`rhPr_${p}` as never)}</span>;
}

/** "Decision due in 1d 4h" or "Past SLA" while the claim is open. */
export function SlaBadge({ c }: { c: Complaint }) {
  const { t } = useLang();
  if (!isOpenClaim(c)) return null;
  const ms = new Date(slaDueOf(c)).getTime() - Date.now();
  if (ms < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
        <AlertTriangle className="size-3" /> {t("rhPastSla")}
      </span>
    );
  const h = Math.floor(ms / 3600_000);
  const time = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600_000) / 60_000)}m`;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <Clock className="size-3" /> {t("rhDueIn", { time })}
    </span>
  );
}

export function useWhen() {
  const { lang } = useLang();
  return (iso: string, withTime = true) =>
    new Date(iso).toLocaleString(langMeta(lang).locale, withTime ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
}

/** One row in a claims list; opens the claim page. */
export function ClaimCard({ claim: c, order }: { claim: Complaint; order: Order }) {
  const { t } = useLang();
  const when = useWhen();
  const unreadish = c.thread?.length ? c.thread[c.thread.length - 1] : undefined;
  return (
    <Link href={`/resolve/${c.id}`} className="paper group block space-y-2 rounded-2xl p-4 transition hover:ring-2 hover:ring-primary/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
          <p className="truncate font-semibold">
            {t(`oIssue_${c.issue}` as never)} · {claimItem(order, t)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge p={priorityOf(c)} />
          <StatusBadge c={c} />
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">&ldquo;{c.details}&rdquo;</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{t("rhRaisedOn", { date: when(c.createdAt) })}</span>
        {(c.evidence?.length ?? 0) > 0 && <span>📷 {c.evidence!.length}</span>}
        {(c.thread?.length ?? 0) > 0 && <span>💬 {c.thread!.length}</span>}
        {c.assignedTo && <span>{t("rhHandledBy", { name: c.assignedTo.name })}</span>}
        <SlaBadge c={c} />
        <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-primary">
          {t("rhOpenClaim")} <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      {unreadish && unreadish.by !== "customer" && isOpenClaim(c) && (
        <p className="truncate rounded-xl bg-primary/5 px-2.5 py-1.5 text-xs">
          <b>{unreadish.name}:</b> {unreadish.text}
        </p>
      )}
    </Link>
  );
}

/** Submitted → AI review → Investigation → Decision → Closed. */
export function StageProgress({ c }: { c: Complaint }) {
  const { t } = useLang();
  const current = CLAIM_STAGES.indexOf(claimStage(c));
  const closed = !isOpenClaim(c);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {CLAIM_STAGES.map((s, i) => {
        const done = i < current || (closed && i <= current);
        const now = i === current && !closed;
        return (
          <li key={s} className="flex flex-col items-center gap-1 text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-teal" : "bg-border")} />
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-2", done ? "bg-teal text-white ring-teal" : now ? "bg-card text-primary ring-primary" : "bg-card text-muted-foreground ring-border")}>
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === CLAIM_STAGES.length - 1 ? "bg-transparent" : i < current ? "bg-teal" : "bg-border")} />
            </div>
            <span className={cn("text-[11px] leading-tight", now ? "font-bold text-primary" : done ? "font-semibold" : "text-muted-foreground")}>{t(`rhStage_${s}` as never)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Raise a warranty claim in three steps, like a support ticket: what went wrong (sets the priority
 * and the decision deadline), the details and photos, then review. The PayPal invoice is attached.
 */
export function ClaimForm({ order, onCancel }: { order: Order; onCancel?: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [issue, setIssue] = useState<Complaint["issue"] | null>(null);
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [picker, setPicker] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refunded = order.paypal.refunds.reduce((s, r) => s + r.amount, 0);
  const steps = [t("rhStepWhat"), t("rhStepDetails"), t("rhStepReview")];
  async function submit() {
    if (!issue) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ order: Order }>(`/api/orders/${order.id}/complaint`, { issue, details, evidence: photos });
      router.push(`/resolve/${r.order.complaints[0].id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-bold", i < step ? "bg-teal text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
            <span className={cn(i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("oWhatWrong")}</p>
          {ISSUES.map((i) => (
            <button
              key={i}
              onClick={() => setIssue(i)}
              className={cn("flex w-full items-start gap-3 rounded-xl p-2.5 text-left ring-1 transition", issue === i ? "bg-primary/10 ring-primary" : "ring-border hover:bg-muted")}
            >
              <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ring-2", issue === i ? "bg-primary ring-primary" : "ring-border")}>{issue === i && <Check className="size-3 text-primary-foreground" />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {t(`oIssue_${i}` as never)} <PriorityBadge p={DEFAULT_PRIORITY[i]} />
                </span>
                <span className="block text-xs text-muted-foreground">{t(`rhIssueHelp_${i}` as never)}</span>
              </span>
            </button>
          ))}
          <p className="text-[11px] text-muted-foreground">{t("rhPriorityNote")}</p>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                {t("rhCancel")}
              </Button>
            )}
            <Button className="flex-1" disabled={!issue} onClick={() => setStep(1)}>
              {t("rhNext")}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{t("rhDescribe")}</p>
            <Textarea placeholder={t("oTellUs")} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} className="mt-1 min-h-28" />
            <p className={cn("mt-1 text-right text-[11px]", details.trim().length < 10 ? "text-muted-foreground" : "text-teal")}>{t("rhChars", { n: details.trim().length })}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{t("rhEvidence")}</p>
            <p className="text-xs text-muted-foreground">{t("rhEvidenceHelp", { n: 5 })}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((f) => (
                <div key={f} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/uploads/${f}`} alt="" className="aspect-square w-full rounded-xl object-cover ring-1 ring-border" />
                  <button onClick={() => setPhotos((p) => p.filter((x) => x !== f))} aria-label={t("rhRemove")} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            {photos.length < 5 && (
              <div className="mt-2">
                <PhotoPicker key={picker} compact label={photos.length ? t("rhAddAnother") : t("oAddPhoto")} onUploaded={(f) => (setPhotos((p) => [...p, f].slice(0, 5)), setPicker((k) => k + 1))} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              {t("rhBack")}
            </Button>
            <Button className="flex-1" disabled={details.trim().length < 10} onClick={() => setStep(2)}>
              {t("rhNext")}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && issue && (
        <div className="space-y-3">
          <dl className="space-y-1.5 rounded-2xl bg-muted/50 p-3 text-sm">
            <Row k={t("rhRepair")} v={claimItem(order, t)} />
            <Row k={t("rhIssue")} v={t(`oIssue_${issue}` as never)} />
            <Row k={t("rhPriority")} v={<PriorityBadge p={DEFAULT_PRIORITY[issue]} />} />
            <Row k={t("rhPhotos")} v={String(photos.length)} />
          </dl>
          <p className="rounded-xl p-2 text-sm ring-1 ring-border">&ldquo;{details.trim()}&rdquo;</p>
          <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold">
              <Receipt className="size-3.5 text-primary" /> {t("oBillAttached")}
            </p>
            <p className="text-muted-foreground">
              Invoice <span className="font-mono">{order.paypal.invoiceId ?? "pending"}</span> · capture <span className="font-mono">{order.paypal.captureId}</span> · {t("oPaid")} {money(order.total)}
              {refunded > 0 && ` · ${t("oRefunded")} ${money(refunded)}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
              {t("rhBack")}
            </Button>
            <Button size="lg" className="flex-1" disabled={busy} onClick={submit}>
              {busy ? t("oReviewing") : t("oSubmit")}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}

/** Photos on the claim; the customer and the karigar can add more while it's open. */
export function EvidenceCard({ claim: c, canAdd, onAdded }: { claim: Complaint; canAdd: boolean; onAdded: () => void }) {
  const { t } = useLang();
  const when = useWhen();
  const [picker, setPicker] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const evidence = c.evidence ?? [];
  async function add(file: string) {
    setError(null);
    try {
      await api(`/api/claims/${c.id}`, { action: "evidence", url: file });
      setPicker((k) => k + 1);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="paper space-y-3 rounded-2xl p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <FileSearch className="size-4 text-primary" /> {t("rhEvidence")} <span className="text-xs font-normal text-muted-foreground">({evidence.length})</span>
      </h2>
      {evidence.length === 0 && <p className="text-sm text-muted-foreground">{t("rhNoEvidence")}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {evidence.map((e) => (
          <a key={e.url} href={`/api/uploads/${e.url}`} target="_blank" rel="noreferrer" className="group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/uploads/${e.url}`} alt={e.caption ?? ""} className="aspect-square w-full rounded-xl object-cover ring-1 ring-border transition group-hover:ring-primary" />
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {e.name.split(" ")[0]} · {when(e.at)}
            </span>
          </a>
        ))}
      </div>
      {canAdd && evidence.length < MAX_EVIDENCE && (
        <div>
          <PhotoPicker key={picker} compact label={t("rhAddEvidence")} onUploaded={(f) => add(f)} />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}

/** The conversation between the customer, the karigar and the Sudhaar team. */
export function Conversation({ claim: c, me, onSent }: { claim: Complaint; me: "customer" | "karigar" | "admin"; onSent: () => void }) {
  const { t } = useLang();
  const when = useWhen();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = isOpenClaim(c);
  const waiting = (claimStatusOf(c) === "awaiting_customer" && me === "customer") || (claimStatusOf(c) === "awaiting_karigar" && me === "karigar");
  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/claims/${c.id}`, { action: "comment", text, internal });
      setText("");
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tone = (by: string, mine: boolean, internalNote?: boolean) =>
    internalNote ? "bg-marigold/15 ring-1 ring-marigold/40" : mine ? "bg-primary text-primary-foreground" : by === "admin" ? "bg-teal/10 ring-1 ring-teal/30" : by === "karigar" ? "bg-violet-500/10 ring-1 ring-violet-500/30" : "bg-muted";
  return (
    <section className="paper space-y-3 rounded-2xl p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <Inbox className="size-4 text-primary" /> {t("rhConversation")}
      </h2>
      {waiting && <p className="rounded-xl bg-violet-500/10 p-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300">{t("rhWaitingOnYou")}</p>}
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {(c.thread ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("rhNoMessages")}</p>}
        {(c.thread ?? []).map((m) => {
          const mine = m.by === me;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", tone(m.by, mine, m.internal))}>
                <p className={cn("text-[11px] font-semibold", mine && !m.internal ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {m.internal && <Lock className="mr-1 inline size-3" />}
                  {m.name} · {when(m.at)}
                </p>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      {open || me === "admin" ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={me === "admin" ? "Reply to the customer and karigar, or add an internal note…" : t("rhWriteMessage")} maxLength={1000} />
          <div className="flex items-center gap-3">
            {me === "admin" && (
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (team only)
              </label>
            )}
            <Button className="ml-auto" disabled={busy || text.trim().length < 2} onClick={send}>
              {t("rhSend")}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("rhClosedNoReply")}</p>
      )}
    </section>
  );
}

/** Who did what, with remarks: the claim's audit trail. */
export function ActivityLog({ claim: c }: { claim: Complaint }) {
  const { t } = useLang();
  const when = useWhen();
  const items = [...(c.activity ?? [])].reverse();
  const icon = (by: string) => (by === "system" ? Bot : by === "admin" ? Gavel : ImagePlus);
  return (
    <section className="paper space-y-3 rounded-2xl p-4">
      <h2 className="font-bold">{t("rhActivity")}</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">{t("rhRaisedOn", { date: when(c.createdAt) })}</p>}
      <ol>
        {items.map((a, i) => {
          const Icon = icon(a.by);
          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="grid size-6 place-items-center rounded-full bg-muted">
                  <Icon className="size-3.5 text-primary" />
                </span>
                {i < items.length - 1 && <span className="my-0.5 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-3 text-sm">
                <p className="font-semibold">{a.action}</p>
                {a.remarks && <p className="text-xs text-muted-foreground">{a.remarks}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {a.name} · {when(a.at)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
