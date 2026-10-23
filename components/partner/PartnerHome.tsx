"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { rupees } from "../Inr";
import { useLang } from "../LanguageProvider";
import { useSession } from "../SessionProvider";
import { langMeta } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PartnerData = {
  role: "karigar" | "saathi";
  profile: {
    id: string;
    name: string;
    shop?: string;
    rating: number;
    jobsDone?: number;
    bio?: string;
    turnaroundDays?: number;
    services?: { name: string; price: number }[];
    area?: string;
    vehicle?: string;
    ratingCount?: number;
    craft?: string;
  };
  online: boolean;
  earnings: { orderId: string; item: string; amount: number; status: string; tip?: boolean; batchId?: string; at: string }[];
  totalEarned: number;
  stats: { active: number; finished: number; tips: number; weekTotal: number; km?: number; avgStars: number | null };
  week: { day: string; amount: number }[];
  reviews: { orderId: string; item: string; stars: number; text: string; at: string; by: string }[];
  sharingLocation: { at: string; simulated: boolean; lat: number; lng: number } | null;
  partners?: { karigars: { id: string; name: string }[]; saathis: { id: string; name: string }[] };
};

/** Loads the signed-in partner's dashboard (an admin picks whose app to view). */
export function usePartner(kind: "karigar" | "saathi") {
  const { account } = useSession();
  const [viewAs, setViewAs] = useState<string | null>(null);
  const [data, setData] = useState<PartnerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = account?.role === "admin";
  const id = isAdmin ? (viewAs ?? (kind === "karigar" ? "k-mohan" : "s-vikas")) : null;
  const load = useCallback(() => {
    api<PartnerData>(`/api/partner/me${id ? `?id=${id}` : ""}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);
  return { data, error, reload: load, isAdmin, viewAs: id, setViewAs };
}

/** Greeting, online switch and earnings at the top of the Karigar and Saathi apps. */
export function PartnerHeader({ data, isAdmin, viewAs, setViewAs, onChange }: { data: PartnerData; isAdmin: boolean; viewAs: string | null; setViewAs: (id: string) => void; onChange: () => void }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const list = data.role === "karigar" ? data.partners?.karigars : data.partners?.saathis;
  async function toggle() {
    setBusy(true);
    try {
      await api("/api/partner/online", { online: !data.online });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {isAdmin && list && (
        <select className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm" value={viewAs ?? ""} onChange={(e) => setViewAs(e.target.value)} aria-label="View as">
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              Admin view: {p.name}
            </option>
          ))}
        </select>
      )}
      <div className="paper flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-gradient-to-br from-marigold/25 via-card to-teal/10 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t("kaHello", { name: data.profile.name.split(" ")[0] })}</p>
          <p className="font-display text-2xl font-bold">{data.profile.shop ?? data.profile.name}</p>
          <p className="text-xs text-muted-foreground">{data.role === "karigar" ? t("kaKeep") : t("saKeep")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.role === "karigar" && (
            <Link href={`/karigars/${data.profile.id}`} className="rounded-full px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/10">
              {t("kaProfile")}
            </Link>
          )}
          <button
            role="switch"
            aria-checked={data.online}
            disabled={busy || isAdmin}
            onClick={toggle}
            className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-60", data.online ? "bg-teal/15 text-teal ring-teal/30" : "bg-muted text-muted-foreground ring-border")}
          >
            <span className={cn("size-2 rounded-full", data.online ? "bg-teal" : "bg-muted-foreground")} />
            {data.online ? t("kaOnline") : t("kaOffline")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EarningsList({ data }: { data: PartnerData }) {
  const { t, lang } = useLang();
  if (data.earnings.length === 0) return <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("kaNoEarnings")}</p>;
  return (
    <div className="paper divide-y divide-border rounded-2xl px-4">
      {data.earnings.map((e) => (
        <div key={`${e.orderId}-${e.amount}-${e.batchId}`} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {e.tip && <span className="mr-1.5 rounded-full bg-marigold/20 px-1.5 text-[10px] font-semibold text-[#7a4a06]">{t("earnTip")}</span>}
              {e.item}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("kaPaidOn", { date: new Date(e.at).toLocaleDateString(langMeta(lang).locale) })} · <span className="font-mono">{e.batchId}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-teal">+{rupees(e.amount)}</p>
            <p className="text-[10px] text-muted-foreground">{e.status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Tabs2({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {items.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("rounded-lg py-1.5 text-sm font-semibold", value === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** A row of headline numbers at the top of the Karigar and Saathi apps. */
export function StatStrip({ items }: { items: { label: string; value: string; sub?: string; tone?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="paper rounded-2xl p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">{i.label}</p>
          <p className={cn("font-display text-2xl font-bold", i.tone)}>{i.value}</p>
          {i.sub && <p className="truncate text-[10px] text-muted-foreground">{i.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/** Last 7 days of PayPal payouts as simple bars. */
export function WeekChart({ week }: { week: PartnerData["week"] }) {
  const { t, lang } = useLang();
  const max = Math.max(...week.map((d) => d.amount), 0.01);
  return (
    <div className="paper space-y-3 rounded-2xl p-4">
      <p className="text-sm font-semibold">{t("ptWeek")}</p>
      <div className="flex h-32 items-end gap-2" role="img" aria-label={t("ptWeek")}>
        {week.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{d.amount ? rupees(d.amount) : ""}</span>
            <div className="w-full rounded-t-md bg-teal/70" style={{ height: `${Math.max(3, (d.amount / max) * 88)}px`, opacity: d.amount ? 1 : 0.25 }} />
            <span className="text-[10px] text-muted-foreground">{new Date(d.day + "T12:00:00Z").toLocaleDateString(langMeta(lang).locale, { weekday: "short" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Asks PayPal's Payouts API for the latest status of this partner's payouts. */
export function PayoutCheck({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          try {
            const r = await api<{ checked: number; results: { batchId: string; status: string }[] }>("/api/partner/payouts", {});
            setNote(r.checked ? t("ptChecked", { n: r.checked, status: [...new Set(r.results.map((x) => x.status))].join(", ") }) : t("ptNothingToCheck"));
            onDone();
          } catch (e) {
            setNote((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full bg-[#0070e0]/10 px-3 py-1.5 text-xs font-semibold text-paypal-blue ring-1 ring-[#0070e0]/30 hover:bg-[#0070e0]/15 disabled:opacity-60"
      >
        {busy ? "…" : t("ptCheckPaypal")}
      </button>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export function TabsN({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 no-scrollbar">
      {items.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold", value === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}
