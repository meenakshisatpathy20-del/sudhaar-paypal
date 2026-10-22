"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { rupees, UsdNote } from "../Inr";
import { useLang } from "../LanguageProvider";
import { useSession } from "../SessionProvider";
import { langMeta } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PartnerData = {
  role: "karigar" | "saathi";
  profile: { id: string; name: string; shop?: string; rating: number; jobsDone?: number };
  online: boolean;
  earnings: { orderId: string; item: string; amount: number; status: string; tip?: boolean; batchId?: string; at: string }[];
  totalEarned: number;
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
      <div className="paper space-y-3 rounded-2xl bg-gradient-to-br from-marigold/25 to-card p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t("kaHello", { name: data.profile.name.split(" ")[0] })}</p>
          <button
            role="switch"
            aria-checked={data.online}
            disabled={busy || isAdmin}
            onClick={toggle}
            className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition disabled:opacity-60", data.online ? "bg-teal/15 text-teal ring-teal/30" : "bg-muted text-muted-foreground ring-border")}
          >
            <span className={cn("size-2 rounded-full", data.online ? "bg-teal" : "bg-muted-foreground")} />
            {data.online ? t("kaOnline") : t("kaOffline")}
          </button>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("kaEarned")}</p>
          <p className="font-display text-4xl font-bold">{rupees(data.totalEarned)}</p>
          <UsdNote usd={data.totalEarned} verb="pays" />
        </div>
        <p className="text-xs text-muted-foreground">{data.role === "karigar" ? t("kaKeep") : t("saKeep")}</p>
        {data.role === "karigar" && (
          <Link href={`/karigars/${data.profile.id}`} className="text-xs font-semibold text-primary underline">
            {t("kaProfile")}
          </Link>
        )}
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
