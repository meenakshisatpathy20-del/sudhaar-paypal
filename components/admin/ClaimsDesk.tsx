"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, Search } from "lucide-react";
import { CLAIM_PRIORITIES, CLAIM_STATUSES, claimStatusOf, isOpenClaim, pastSla, priorityOf, slaDueOf } from "@/lib/claims-shared";
import { cn } from "@/lib/utils";
import type { Complaint, Order } from "@/lib/types";
import { api, money } from "../api";
import { PriorityBadge, SlaBadge, StatusBadge } from "../resolve/Claims";
import { Input } from "../ui/input";

type Row = { claim: Complaint; order: Order };
type Report = { total: number; open: number; resolved: number; rejected: number; withdrawn: number; pastSla: number; avgHours: number | null; refunded: number; byIssue: Record<string, number> };

/** The Sudhaar team's claims desk: queue with filters, quick AI-backed decisions, reports and CSV export. */
export function ClaimsDesk({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [priority, setPriority] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ claims: Row[]; report: Report }>("/api/claims")
      .then((r) => {
        setRows(r.claims);
        setReport(r.report);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function quick(r: Row, decision: "refund" | "re_repair") {
    setBusy(r.claim.id);
    setError(null);
    try {
      await api(`/api/claims/${r.claim.id}`, { action: "decide", decision, amount: r.claim.ai?.refundAmount, remarks: decision === "refund" ? "Refund approved after reviewing your photos and bill." : "We'll re-repair it free under warranty." });
      load();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim().toLowerCase();
  const shown = rows
    .filter(({ claim: c }) => (status === "all" ? true : status === "active" ? isOpenClaim(c) : status === "past_sla" ? pastSla(c) : claimStatusOf(c) === status))
    .filter(({ claim: c }) => priority === "all" || priorityOf(c) === priority)
    .filter(({ claim: c, order: o }) => !q || [c.id, o.id, o.item, o.customer.name, c.details, c.issue].some((x) => x.toLowerCase().includes(q)))
    // Most urgent first: open before closed, then by deadline.
    .sort((a, b) => Number(isOpenClaim(b.claim)) - Number(isOpenClaim(a.claim)) || slaDueOf(a.claim).localeCompare(slaDueOf(b.claim)));

  function csv() {
    const head = ["claim_id", "order_id", "raised", "issue", "priority", "status", "sla_due", "past_sla", "assigned_to", "customer", "item", "paid_usd", "ai_recommendation", "ai_refund_usd", "decision", "refund_usd", "paypal_refund_id", "closed"];
    const lines = rows.map(({ claim: c, order: o }) =>
      [c.id, o.id, c.createdAt, c.issue, priorityOf(c), claimStatusOf(c), slaDueOf(c), pastSla(c), c.assignedTo?.name ?? "", o.customer.name, o.item, o.total, c.ai?.recommendation ?? "", c.ai?.refundAmount ?? "", c.resolution?.action ?? "", c.resolution?.amount ?? "", c.resolution?.refundId ?? "", c.closedAt ?? ""]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sudhaar-claims-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const decided = report ? report.resolved + report.rejected : 0;
  const tiles: [string, string, string?][] = report
    ? [
        ["Open claims", String(report.open)],
        ["Past SLA", String(report.pastSla), report.pastSla ? "text-destructive" : undefined],
        ["Resolution rate", decided ? `${Math.round((report.resolved / decided) * 100)}%` : "—"],
        ["Avg. time to decide", report.avgHours === null ? "—" : report.avgHours < 1 ? `${Math.round(report.avgHours * 60)} min` : `${report.avgHours} h`],
        ["Refunded via PayPal", money(report.refunded)],
        ["All claims", String(report.total)],
      ]
    : [];
  const maxIssue = Math.max(1, ...Object.values(report?.byIssue ?? {}));
  const select = "h-9 rounded-xl border border-border bg-card px-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="paper rounded-2xl p-3">
            <p className="text-[11px] text-muted-foreground">{k}</p>
            <p className={cn("text-xl font-bold", tone)}>{v}</p>
          </div>
        ))}
      </div>
      {report && report.total > 0 && (
        <div className="paper space-y-1.5 rounded-2xl p-3">
          <p className="text-xs font-semibold">Claims by issue</p>
          {Object.entries(report.byIssue).map(([issue, n]) => (
            <div key={issue} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 text-muted-foreground">{issue.replaceAll("_", " ")}</span>
              <span className="h-2.5 rounded-full bg-primary/70" style={{ width: `${(n / maxIssue) * 60}%` }} />
              <span className="font-semibold">{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search claim id, order, customer, item…" className="pl-9" />
        </div>
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="active">Open (all active)</option>
          <option value="past_sla">Past SLA</option>
          <option value="all">All statuses</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select className={select} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="all">All priorities</option>
          {CLAIM_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button onClick={csv} disabled={!rows.length} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-50">
          <Download className="size-4" /> CSV
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {shown.length === 0 && <p className="paper rounded-2xl p-6 text-sm text-muted-foreground">{rows.length ? "No claims match these filters." : "No claims yet. 🎉"}</p>}

      <div className="space-y-2">
        {shown.map((r) => {
          const { claim: c, order: o } = r;
          const open = isOpenClaim(c);
          return (
            <div key={c.id} className={cn("paper space-y-2 rounded-2xl p-4", pastSla(c) && "ring-2 ring-destructive/40")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/resolve/${c.id}`} className="font-mono font-semibold text-primary underline">
                      {c.id}
                    </Link>{" "}
                    · <span className="font-mono">{o.id}</span> · {o.customer.name} · {new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {c.channel && c.channel !== "web" && ` · via ${c.channel}`}
                  </p>
                  <p className="font-semibold">
                    {c.issue.replaceAll("_", " ")} · {o.item}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pastSla(c) && <AlertTriangle className="size-4 text-destructive" />}
                  <PriorityBadge p={priorityOf(c)} />
                  <SlaBadge c={c} />
                  <StatusBadge c={c} />
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">&ldquo;{c.details}&rdquo;</p>
              {c.ai && (
                <p className="rounded-xl bg-primary/10 p-2 text-xs">
                  <b>
                    AI recommends {c.ai.recommendation.replaceAll("_", " ")}
                    {c.ai.refundAmount ? ` of ${money(c.ai.refundAmount)}` : ""}
                  </b>{" "}
                  ({c.ai.source}): {c.ai.reasoning}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  📷 {c.evidence?.length ?? 0} · 💬 {c.thread?.length ?? 0} · {c.assignedTo ? `handled by ${c.assignedTo.name}` : "unassigned"} · paid {money(o.total)}
                </span>
                <span className="flex-1" />
                {open && c.ai && c.ai.refundAmount > 0 && (
                  <button disabled={busy === c.id} onClick={() => quick(r, "refund")} className="rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50">
                    Approve PayPal refund {money(c.ai.refundAmount)}
                  </button>
                )}
                {open && (
                  <button disabled={busy === c.id} onClick={() => quick(r, "re_repair")} className="rounded-xl px-3 py-2 font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-50">
                    Free re-repair
                  </button>
                )}
                <Link href={`/resolve/${c.id}`} className="rounded-xl px-3 py-2 font-semibold text-primary ring-1 ring-primary/40 hover:bg-primary/10">
                  Open case →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
