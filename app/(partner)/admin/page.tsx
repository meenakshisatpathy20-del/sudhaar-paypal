"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { api, money } from "@/components/api";
import { STATUS_LABEL } from "@/components/StatusPill";
import type { Karigar, Order, Saathi } from "@/lib/types";

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
  const [tab, setTab] = useState<"orders" | "payouts" | "karigars" | "webhooks">("orders");
  const load = useCallback(() => api<AdminData>("/api/admin").then(setData).catch(() => {}), []);
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
  const karigarCols = useMemo<ColDef<Karigar>[]>(
    () => [
      { field: "shop", flex: 1, minWidth: 180 },
      { field: "name", width: 150 },
      { field: "skills", valueFormatter: (p) => (p.value as string[]).join(", "), minWidth: 200, flex: 1 },
      { field: "area", width: 130 },
      { field: "rating", width: 90 },
      { field: "jobsDone", headerName: "Jobs", width: 90 },
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

  if (!data) return <p className="paper rounded-2xl p-5 text-muted-foreground">Loading dashboard…</p>;
  const i = data.impact;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">Operations</h1>
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
      <div className="flex gap-1">
        {(["orders", "payouts", "karigars", "webhooks"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {t === "webhooks" ? "PayPal webhooks" : t}
          </button>
        ))}
      </div>
      <div className="h-[560px] overflow-hidden rounded-2xl">
        {tab === "orders" && <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={orderCols} pagination paginationPageSize={20} defaultColDef={{ sortable: true, resizable: true }} />}
        {tab === "payouts" && <AgGridReact theme={theme} rowData={payoutRows} columnDefs={payoutCols} defaultColDef={{ sortable: true, resizable: true }} />}
        {tab === "karigars" && <AgGridReact<Karigar> theme={theme} rowData={data.karigars} columnDefs={karigarCols} defaultColDef={{ sortable: true, resizable: true, filter: true }} />}
        {tab === "webhooks" && <AgGridReact theme={theme} rowData={data.webhooks} columnDefs={hookCols} defaultColDef={{ sortable: true, resizable: true }} />}
      </div>
    </div>
  );
}
