"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { api, money } from "@/components/api";
import { STATUS_LABEL } from "@/components/StatusPill";
import { CATEGORY_LABEL } from "@/lib/pricing";
import type { HealthReport, ServiceStatus } from "@/lib/health";
import type { Complaint, CompletionCheck, Karigar, KarigarApplication, Order, Saathi } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "#d9572b",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#fbe9d3",
  oddRowBackgroundColor: "#fffaf3",
  foregroundColor: "#2b1d14",
  borderColor: "#ecdcc6",
  fontSize: 13,
  borderRadius: 10,
  wrapperBorderRadius: 16,
});

type Impact = { itemsRepaired: number; kgSaved: number; moneySaved: number; karigarEarnings: number; saathiEarnings: number; refunds: number; toolFund: number; activeOrders: number };
type AdminData = { orders: Order[]; karigars: Karigar[]; saathis: Saathi[]; webhooks: { at: string; type: string; resource?: string; verified: boolean }[]; impact: Impact };

type Row = {
  id: string;
  created: string;
  item: string;
  karigar: string;
  status: string;
  mode: string;
  total: number;
  karigarPaid: number;
  saathiPaid: number;
  platform: number;
  refunded: number;
  authorization?: string;
  capture?: string;
  payoutBatch?: string;
  invoice?: string;
  complaints: number;
  bookedBy: string;
};

export default function Admin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<"orders" | "resolve" | "checks" | "applications" | "customers" | "karigars" | "saathis" | "payouts" | "webhooks">("orders");
  const [apps, setApps] = useState<KarigarApplication[]>([]);
  const load = useCallback(() => {
    api<AdminData>("/api/admin").then(setData).catch(() => {});
    api<{ applications: KarigarApplication[] }>("/api/applications").then((r) => setApps(r.applications)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const kname = new Map(data.karigars.map((k) => [k.id, k.shop]));
    return data.orders.map((o) => ({
      id: o.id,
      created: o.createdAt,
      item: o.item,
      karigar: kname.get(o.karigarId) ?? o.karigarId,
      status: STATUS_LABEL[o.status],
      mode: o.mode,
      total: o.total,
      karigarPaid: o.payouts.filter((p) => p.to === "karigar").reduce((s, p) => s + p.amount, 0),
      saathiPaid: o.payouts.filter((p) => p.to === "saathi").reduce((s, p) => s + p.amount, 0),
      platform: o.paypal.captureId ? o.split.platform : 0,
      refunded: o.paypal.refunds.reduce((s, r) => s + r.amount, 0),
      authorization: o.paypal.authorizationId,
      capture: o.paypal.captureId,
      payoutBatch: o.paypal.payoutBatchId,
      invoice: o.paypal.invoiceId,
      complaints: o.complaints.filter((c) => !c.resolution).length,
      bookedBy: o.bookedBy,
    }));
  }, [data]);

  const usd = (p: { value: number }) => (p.value ? money(p.value) : "–");
  const orderCols = useMemo<ColDef<Row>[]>(
    () => [
      { field: "id", headerName: "Order", pinned: "left", width: 120, cellRenderer: (p: ICellRendererParams<Row>) => <Link className="font-mono text-primary underline" href={`/orders/${p.value}`}>{p.value}</Link> },
      { field: "created", headerName: "Booked", width: 150, valueFormatter: (p) => new Date(p.value).toLocaleString(), sort: "desc" },
      { field: "item", flex: 1, minWidth: 160 },
      { field: "karigar", minWidth: 150 },
      { field: "status", width: 140, filter: true },
      { field: "bookedBy", headerName: "Booked by", width: 110, filter: true },
      { field: "total", width: 100, valueFormatter: usd },
      { field: "karigarPaid", headerName: "Karigar paid", width: 120, valueFormatter: usd },
      { field: "saathiPaid", headerName: "Saathi paid", width: 115, valueFormatter: usd },
      { field: "platform", headerName: "Sudhaar", width: 100, valueFormatter: usd },
      { field: "refunded", width: 105, valueFormatter: usd },
      { field: "complaints", headerName: "Open issues", width: 115 },
      { field: "authorization", headerName: "PayPal authorization", width: 190 },
      { field: "capture", headerName: "PayPal capture", width: 190 },
      { field: "payoutBatch", headerName: "Payout batch", width: 170 },
      { field: "invoice", headerName: "Invoice", width: 200 },
    ],
    [],
  );

  const payoutRows = useMemo(
    () =>
      (data?.orders ?? []).flatMap((o) =>
        o.payouts.map((p) => ({ order: o.id, to: p.to, receiver: p.receiver, amount: p.amount, status: p.status, batch: o.paypal.payoutBatchId, at: o.events.find((e) => e.status === "paid_out")?.at })),
      ),
    [data],
  );
  const payoutCols = useMemo<ColDef[]>(
    () => [
      { field: "at", headerName: "Paid at", width: 170, valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : "") },
      { field: "order", width: 120 },
      { field: "to", headerName: "Recipient", width: 110, filter: true },
      { field: "receiver", flex: 1, minWidth: 200 },
      { field: "amount", width: 110, valueFormatter: usd },
      { field: "status", width: 120 },
      { field: "batch", headerName: "PayPal payout batch", width: 200 },
    ],
    [],
  );
  // Customers: everyone who booked or paid (including Family Pay payers), built from orders.
  const customerRows = useMemo(() => {
    const m = new Map<string, { name: string; email: string; role: string; orders: number; spent: number; refunded: number; last: string }>();
    for (const o of data?.orders ?? []) {
      const payer = o.familyPay ? { name: o.familyPay.name, email: o.familyPay.paidBy ?? "", role: `Family Pay (${o.familyPay.relation})` } : null;
      for (const who of [{ name: o.customer.name, email: o.customer.email, role: "Customer" }, ...(payer ? [payer] : [])]) {
        const key = `${who.name}|${who.role}`;
        const r = m.get(key) ?? { ...who, orders: 0, spent: 0, refunded: 0, last: o.createdAt };
        r.orders += 1;
        const paidByThisPerson = o.familyPay ? who.role !== "Customer" : true;
        if (o.paypal.captureId && paidByThisPerson) r.spent += o.total;
        if (paidByThisPerson) r.refunded += o.paypal.refunds.reduce((a, x) => a + x.amount, 0);
        if (o.createdAt > r.last) r.last = o.createdAt;
        m.set(key, r);
      }
    }
    return [...m.values()];
  }, [data]);
  const customerCols = useMemo<ColDef[]>(
    () => [
      { field: "name", flex: 1, minWidth: 150 },
      { field: "role", width: 190, filter: true },
      { field: "email", width: 230 },
      { field: "orders", width: 100 },
      { field: "spent", headerName: "Paid (captured)", width: 140, valueFormatter: usd },
      { field: "refunded", width: 110, valueFormatter: usd },
      { field: "last", headerName: "Last booking", width: 170, valueFormatter: (p) => new Date(p.value).toLocaleString() },
    ],
    [],
  );
  const karigarRows = useMemo(
    () =>
      (data?.karigars ?? []).map((k) => {
        const mine = (data?.orders ?? []).filter((o) => (o.jobs?.length ? o.jobs.some((j) => j.karigarId === k.id) : o.karigarId === k.id));
        const earned = mine
          .filter((o) => o.paypal.payoutBatchId)
          .reduce((s, o) => s + (o.jobs?.length ? o.jobs.filter((j) => j.karigarId === k.id).reduce((a, j) => a + j.price * 0.9, 0) : (o.payouts.find((p) => p.to === "karigar")?.amount ?? 0)), 0);
        return { ...k, active: mine.filter((o) => !["paid_out", "cancelled", "awaiting_payment"].includes(o.status)).length, completed: mine.filter((o) => o.status === "paid_out").length, earned };
      }),
    [data],
  );
  const saathiRows = useMemo(
    () =>
      (data?.saathis ?? []).map((sa) => {
        const mine = (data?.orders ?? []).filter((o) => o.saathiId === sa.id && o.mode === "pickup");
        return {
          ...sa,
          trips: mine.filter((o) => o.paypal.captureId).length,
          active: mine.filter((o) => ["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"].includes(o.status)).length,
          earned: mine.reduce((a, o) => a + o.payouts.filter((p) => p.to === "saathi").reduce((x, p) => x + p.amount, 0), 0),
        };
      }),
    [data],
  );
  const saathiCols = useMemo<ColDef[]>(
    () => [
      { field: "name", flex: 1, minWidth: 180 },
      { field: "rating", width: 90 },
      { field: "active", headerName: "Active jobs", width: 120 },
      { field: "trips", headerName: "Trips done", width: 120 },
      { field: "earned", headerName: "Earned (Payouts)", width: 150, valueFormatter: usd },
      { field: "payoutEmail", headerName: "PayPal payout email", width: 260 },
    ],
    [],
  );
  const karigarCols = useMemo<ColDef<Karigar & { active: number; completed: number; earned: number }>[]>(
    () => [
      { field: "shop", flex: 1, minWidth: 180 },
      { field: "name", width: 150 },
      { field: "skills", valueFormatter: (p) => (p.value as string[]).join(", "), minWidth: 200, flex: 1 },
      { field: "area", width: 130 },
      { field: "rating", width: 90 },
      { field: "jobsDone", headerName: "Jobs (lifetime)", width: 130 },
      { field: "active", headerName: "Active", width: 90 },
      { field: "completed", headerName: "On Sudhaar", width: 110 },
      { field: "earned", headerName: "Earned (Payouts)", width: 150, valueFormatter: usd },
      { field: "verified", headerName: "KYC", width: 80, valueFormatter: (p) => (p.value ? "✓" : "–") },
      { field: "languages", valueFormatter: (p) => (p.value as string[]).join(", "), width: 160 },
      { field: "payoutEmail", headerName: "PayPal payout email", width: 220 },
    ],
    [],
  );
  const hookCols = useMemo<ColDef[]>(
    () => [
      { field: "at", width: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
      { field: "type", flex: 1 },
      { field: "resource", width: 220 },
      { field: "verified", width: 110, valueFormatter: (p) => (p.value ? "✓ signature" : "unverified") },
    ],
    [],
  );

  const openComplaints = (data?.orders ?? []).flatMap((o) => o.complaints.filter((c) => !c.resolution).map((c) => ({ order: o, complaint: c })));
  const photoChecks = (data?.orders ?? []).flatMap((o): PhotoCheckItem[] =>
    o.jobs?.length
      ? o.jobs
          .filter((j) => j.status === "repairing" && j.afterPhoto && j.completionCheck?.needsReview)
          .map((j) => ({ order: o, jobId: j.id, item: j.item, issue: j.issue, before: j.beforePhoto, after: j.afterPhoto, check: j.completionCheck! }))
      : o.status === "repairing" && o.afterPhoto && o.completionCheck?.needsReview
        ? [{ order: o, item: o.item, issue: o.issue, before: o.beforePhoto, after: o.afterPhoto, check: o.completionCheck }]
        : [],
  );
  if (!data) return <p className="paper rounded-2xl p-5 text-muted-foreground">Loading dashboard…</p>;
  const i = data.impact;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">Admin console</h1>
          <p className="text-sm text-muted-foreground">Every hold, capture, payout, invoice and refund, straight from PayPal.</p>
        </div>
        <button
          className="rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-border hover:bg-muted"
          onClick={() => {
            if (confirm("Reset demo data? All orders will be removed.")) api("/api/reset", {}).then(load);
          }}
        >
          Reset demo data
        </button>
      </div>
      <SystemCheck />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {[
          ["Repairs completed", String(i.itemsRepaired)],
          ["Active jobs", String(i.activeOrders)],
          ["Waste avoided", `${i.kgSaved} kg`],
          ["Customer savings", money(i.moneySaved)],
          ["Paid to karigars", money(i.karigarEarnings)],
          ["Paid to Saathis", money(i.saathiEarnings)],
          ["Refunded", money(i.refunds)],
          ["Tool fund", money(i.toolFund)],
        ].map(([k, v]) => (
          <div key={k} className="paper rounded-2xl p-3">
            <p className="font-display text-xl font-bold text-primary">{v}</p>
            <p className="text-xs text-muted-foreground">{k}</p>
          </div>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto">
        {(["orders", "resolve", "checks", "applications", "customers", "karigars", "saathis", "payouts", "webhooks"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {t === "webhooks" ? "PayPal webhooks" : t === "resolve" ? `Resolve Hub (${openComplaints.length})` : t === "checks" ? `Photo checks (${photoChecks.length})` : t === "applications" ? `Applications (${apps.filter((a) => a.status === "pending").length})` : t}
          </button>
        ))}
      </div>
      {tab === "resolve" && <ResolveQueue items={openComplaints} onDone={load} />}
      {tab === "checks" && <PhotoCheckQueue items={photoChecks} onDone={load} />}
      {tab === "applications" && <Applications apps={apps} onDone={load} />}
      <div className={tab === "resolve" || tab === "checks" || tab === "applications" ? "hidden" : "h-[560px] overflow-hidden rounded-2xl"}>
        {tab === "orders" && <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={orderCols} pagination paginationPageSize={20} defaultColDef={{ sortable: true, resizable: true }} />}
        {tab === "payouts" && <AgGridReact theme={theme} rowData={payoutRows} columnDefs={payoutCols} defaultColDef={{ sortable: true, resizable: true }} />}
        {tab === "karigars" && <AgGridReact theme={theme} rowData={karigarRows} columnDefs={karigarCols} defaultColDef={{ sortable: true, resizable: true, filter: true }} />}
        {tab === "customers" && <AgGridReact theme={theme} rowData={customerRows} columnDefs={customerCols} defaultColDef={{ sortable: true, resizable: true }} />}
        {tab === "saathis" && <AgGridReact theme={theme} rowData={saathiRows} columnDefs={saathiCols} defaultColDef={{ sortable: true, resizable: true }} />}
        {tab === "webhooks" && <AgGridReact theme={theme} rowData={data.webhooks} columnDefs={hookCols} defaultColDef={{ sortable: true, resizable: true }} />}
      </div>
    </div>
  );
}

/** Support desk: humans approve the AI's recommendation before any PayPal refund is sent. */
function ResolveQueue({ items, onDone }: { items: { order: Order; complaint: Complaint }[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function resolve(o: Order, c: Complaint, action: "refund" | "re_repair" | "rejected", amount?: number) {
    setBusy(c.id);
    setError(null);
    try {
      await api(`/api/orders/${o.id}/resolve`, { complaintId: c.id, action, amount });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  if (items.length === 0) return <p className="paper rounded-2xl p-6 text-sm text-muted-foreground">No open complaints. 🎉</p>;
  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {items.map(({ order: o, complaint: c }) => (
        <div key={c.id} className="paper space-y-2 rounded-2xl p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">
              {c.issue.replaceAll("_", " ")} · {o.item}{" "}
              <Link href={`/orders/${o.id}`} className="font-mono text-xs text-primary underline">
                {o.id}
              </Link>
            </p>
            <span className="text-xs text-muted-foreground">
              paid {money(o.total)} · capture <span className="font-mono">{o.paypal.captureId}</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">&ldquo;{c.details}&rdquo;</p>
          {c.ai && (
            <p className="rounded-xl bg-primary/10 p-2 text-xs">
              <b>
                AI recommends {c.ai.recommendation.replaceAll("_", " ")}
                {c.ai.refundAmount ? ` of ${money(c.ai.refundAmount)}` : ""}
              </b>{" "}
              ({c.ai.source}): {c.ai.reasoning}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {c.ai && c.ai.refundAmount > 0 && (
              <button disabled={busy === c.id} onClick={() => resolve(o, c, "refund", c.ai!.refundAmount)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                Approve PayPal refund {money(c.ai.refundAmount)}
              </button>
            )}
            <button disabled={busy === c.id} onClick={() => resolve(o, c, "re_repair")} className="rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-50">
              Free re-repair
            </button>
            <button disabled={busy === c.id} onClick={() => resolve(o, c, "rejected")} className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">
              Close without refund
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

type PhotoCheckItem = { order: Order; jobId?: string; item: string; issue: string; before?: string; after?: string; check: CompletionCheck };

/** Repairs the AI could not pass. A person compares the photos; the money stays held until then. */
function PhotoCheckQueue({ items, onDone }: { items: PhotoCheckItem[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function review(x: PhotoCheckItem, approve: boolean) {
    const key = x.jobId ?? x.order.id;
    setBusy(key);
    setError(null);
    try {
      await api(`/api/orders/${x.order.id}/review`, { jobId: x.jobId, approve });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  if (items.length === 0) return <p className="paper rounded-2xl p-6 text-sm text-muted-foreground">No repair photos waiting for review. 🎉</p>;
  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {items.map((x) => {
        const key = x.jobId ?? x.order.id;
        return (
          <div key={key} className="paper space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {x.item}{" "}
                <Link href={`/orders/${x.order.id}`} className="font-mono text-xs text-primary underline">
                  {x.order.id}
                </Link>
              </p>
              <span className="text-xs text-muted-foreground">held by PayPal · {money(x.order.total)}</span>
            </div>
            <p className="text-sm text-muted-foreground">Reported issue: {x.issue}</p>
            <div className="grid max-w-md grid-cols-2 gap-3">
              {[
                ["Before", x.before],
                ["After", x.after],
              ].map(([label, file]) => (
                <figure key={label} className="space-y-1">
                  {file ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${file}`} alt={`${label} photo`} className="aspect-square w-full rounded-xl object-cover ring-1 ring-border" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-xl bg-muted text-xs text-muted-foreground">No photo</div>
                  )}
                  <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
                </figure>
              ))}
            </div>
            <p className="rounded-xl bg-marigold/15 p-2 text-xs">
              <b>{x.check.source === "admin" ? "Reviewer" : "AI"}:</b> {x.check.reasoning}
            </p>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy === key} onClick={() => review(x, true)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                Repair looks good, approve
              </button>
              <button disabled={busy === key} onClick={() => review(x, false)} className="rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-50">
                Send back to karigar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CHECK_LABEL = {
  idVerified: "ID verified (in person / DigiLocker)",
  shopVisited: "Shop visited, location pinned",
  trialRepair: "Trial repair passed",
  trained: "Trained on OTP handovers",
  trialTrip: "Trial trip done",
} as const;
const CHECKS_FOR = { karigar: ["idVerified", "shopVisited", "trialRepair"], saathi: ["idVerified", "trained", "trialTrip"] } as const;

/** Karigar onboarding: three KYC checks by the team, then the karigar becomes bookable. */
function Applications({ apps: fromServer, onDone }: { apps: KarigarApplication[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Show ticked checks immediately; the next load brings the saved state.
  const [apps, setApps] = useState(fromServer);
  const [issued, setIssued] = useState<{ name: string; phone: string; pin: string } | null>(null);
  useEffect(() => setApps(fromServer), [fromServer]);
  async function act(id: string, body: { action: "check"; check: keyof typeof CHECK_LABEL; value: boolean } | { action: "approve" | "reject" }) {
    setBusy(id);
    setError(null);
    if (body.action === "check") setApps((list) => list.map((a) => (a.id === id ? { ...a, checks: { ...a.checks, [body.check]: body.value } } : a)));
    try {
      const r = await api<{ application: KarigarApplication; pin?: string }>(`/api/applications/${id}`, body);
      if (r.pin) setIssued({ name: r.application.name, phone: r.application.phone, pin: r.pin });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  if (apps.length === 0)
    return (
      <p className="paper rounded-2xl p-6 text-sm text-muted-foreground">
        No applications yet. Karigars and Saathis apply from <Link href="/join" className="text-primary underline">/join</Link> (linked on the customer home page).
      </p>
    );
  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {issued && (
        <div className="rounded-2xl bg-teal/10 p-4 text-sm ring-1 ring-teal/30">
          <p className="font-semibold">
            Login created for {issued.name}: phone {issued.phone}, PIN <span className="font-mono text-lg">{issued.pin}</span>
          </p>
          <p className="text-xs text-muted-foreground">Shown only once. Hand it over in person; Sudhaar stores only a hash of the PIN.</p>
        </div>
      )}
      {apps.map((a) => {
        const kind = a.kind ?? "karigar";
        const allChecked = CHECKS_FOR[kind].every((c) => a.checks[c]);
        return (
          <div key={a.id} className="paper space-y-2 rounded-2xl p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] ${kind === "saathi" ? "bg-marigold/20 text-gold" : "bg-teal/15 text-teal"}`}>{kind === "saathi" ? "Saathi" : "Karigar"}</span>
                {kind === "saathi" ? a.name : `${a.shop} · ${a.name}`} <span className="font-mono text-xs text-muted-foreground">{a.id}</span>
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "approved" ? "bg-teal/15 text-teal" : a.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-marigold/20 text-gold"}`}>{a.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {kind === "saathi"
                ? `${a.area} · ${a.vehicle} · free: ${(a.hours ?? []).join(", ")}${a.student ? " · student" : ""} · ${a.languages.join(", ")}`
                : `${a.craft} · ${a.area} · ${a.yearsExperience} yrs · ${a.skills.map((s) => CATEGORY_LABEL[s]).join(", ")} · ${a.languages.join(", ")}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Phone {a.phone} · ID to show: {a.idType} · PayPal: {a.payoutEmail ?? "not yet (help set up at shop visit)"}
            </p>
            {a.bio && <p className="text-sm italic">&ldquo;{a.bio}&rdquo;</p>}
            {a.status === "pending" ? (
              <>
                <div className="flex flex-wrap gap-3">
                  {CHECKS_FOR[kind].map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input type="checkbox" className="size-4 accent-[#d9572b]" checked={Boolean(a.checks[c])} disabled={busy === a.id} onChange={(e) => act(a.id, { action: "check", check: c, value: e.target.checked })} />
                      {CHECK_LABEL[c]}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy === a.id || !allChecked} onClick={() => act(a.id, { action: "approve" })} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                    {kind === "saathi" ? "Approve Saathi" : "Approve and list karigar"}
                  </button>
                  <button disabled={busy === a.id} onClick={() => act(a.id, { action: "reject" })} className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </>
            ) : (
              a.karigarId && kind === "karigar" && (
                <Link href={`/karigars/${a.karigarId}`} className="text-xs font-semibold text-primary underline">
                  View public profile
                </Link>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Are PayPal and Gemini accepting our keys? Shows the reason and the fix when they aren't. */
function SystemCheck() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fresh: boolean) => {
    setBusy(true);
    setError(null);
    api<{ health: HealthReport }>("/api/health", fresh ? {} : undefined)
      .then((r) => setHealth(r.health))
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  };
  useEffect(() => run(false), []);
  const tone = (s: ServiceStatus) => (s.state === "live" ? "bg-teal/10 ring-teal/30" : s.state === "problem" ? "bg-destructive/10 ring-destructive/30" : "bg-marigold/15 ring-marigold/30");
  const label = (s: ServiceStatus) => (s.state === "live" ? "Live" : s.state === "problem" ? "Needs attention" : "Simulated");
  return (
    <div className="paper space-y-2 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">System check</h2>
        <button className="rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-50" disabled={busy} onClick={() => run(true)}>
          {busy ? "Checking…" : "Run check again"}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {health && (
        <div className="grid gap-2 md:grid-cols-2">
          {([["PayPal", health.paypal], ["Gemini AI", health.gemini]] as const).map(([name, st]) => (
            <div key={name} className={`space-y-1 rounded-xl p-3 text-sm ring-1 ${tone(st)}`}>
              <p className="font-semibold">
                {name}: {label(st)}
              </p>
              <p className="text-muted-foreground">{st.detail}</p>
              {st.fix && st.state !== "live" && <p className="text-xs"><b>Fix:</b> {st.fix}</p>}
            </div>
          ))}
        </div>
      )}
      {health && <p className="text-[11px] text-muted-foreground">Checked {new Date(health.checkedAt).toLocaleTimeString()}. After changing keys on the server, press Run check again.</p>}
    </div>
  );
}
