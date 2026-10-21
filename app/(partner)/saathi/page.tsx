"use client";

import { useState } from "react";
import { Home, MapPin, Store } from "lucide-react";
import { api } from "@/components/api";
import { rupees } from "@/components/Inr";
import { useLang } from "@/components/LanguageProvider";
import { EarningsList, PartnerHeader, Tabs2, usePartner } from "@/components/partner/PartnerHome";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type KarigarBrief, useOrders } from "@/components/useOrders";
import type { Order } from "@/lib/types";

// The Saathi app: only this Saathi's trips (the API filters them). OTPs are never sent to the
// Saathi; they must ask the customer, which proves the customer was really there.
export default function SaathiApp() {
  const { t } = useLang();
  const { orders, karigars, reload } = useOrders();
  const partner = usePartner("saathi");
  const [tab, setTab] = useState("trips");
  const sid = partner.data?.profile.id;
  if (partner.error) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-destructive">{partner.error}</p>;
  if (!partner.data || !sid) return <p className="paper mx-auto max-w-md rounded-2xl p-5 text-sm text-muted-foreground">…</p>;

  const trips = orders.filter((o) => o.saathiId === sid && o.mode === "pickup" && ["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery"].includes(o.status));
  const refresh = () => {
    reload();
    partner.reload();
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PartnerHeader data={partner.data} isAdmin={partner.isAdmin} viewAs={partner.viewAs} setViewAs={partner.setViewAs} onChange={partner.reload} />
      <Tabs2 value={tab} onChange={setTab} items={[["trips", `${t("saTrips")} (${trips.length})`], ["earnings", t("kaHistory")]]} />
      {tab === "earnings" ? (
        <EarningsList data={partner.data} />
      ) : (
        <>
          {trips.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("saNoTrips")}</p>}
          {trips.map((o) => (
            <Trip key={o.id} order={o} karigars={karigars} onDone={refresh} />
          ))}
        </>
      )}
    </div>
  );
}

function Trip({ order, karigars, onDone }: { order: Order; karigars: Record<string, KarigarBrief>; onDone: () => void }) {
  const { t } = useLang();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const basket = order.kind === "basket";
  const stops = [...new Set(basket ? (order.jobs ?? []).map((j) => j.karigarId) : [order.karigarId])].map((id) => karigars[id]).filter(Boolean);
  const step =
    order.status === "authorized"
      ? { action: "pickup", label: t("saPickup"), otp: true }
      : order.status === "picked_up"
        ? { action: "drop_at_karigar", label: basket ? t("saDropBasket") : t("saDrop"), otp: false }
        : order.status === "repaired"
          ? { action: "out_for_delivery", label: t("saCollect"), otp: false }
          : order.status === "out_for_delivery"
            ? { action: "deliver", label: t("saDeliver"), otp: true }
            : null;

  async function run() {
    if (!step) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/action`, { action: step.action, otp });
      setOtp("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper space-y-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
          <p className="font-semibold">{basket ? `🪔 ${t("oBasketTitle", { n: order.jobs?.length ?? 0 })}` : order.item}</p>
          <p className="text-xs text-muted-foreground">
            {order.distanceKm} km · {t("saEarn", { amount: rupees(order.split.saathi) })}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs ring-1 ring-border">
        <p className="font-semibold text-muted-foreground">{t("saStops")}</p>
        <p className="flex items-center gap-2">
          <Home className="size-3.5 shrink-0 text-primary" /> {order.customer.name} · {order.customer.address || "—"}
        </p>
        {stops.map((k) => (
          <p key={k.shop} className="flex items-center gap-2">
            <Store className="size-3.5 shrink-0 text-teal" /> {k.shop} · <MapPin className="size-3 shrink-0" /> {k.area}
          </p>
        ))}
      </div>
      {!step && <p className="text-xs text-muted-foreground">{t("saWaitRepair")}</p>}
      {step && (
        <>
          {step.otp && (
            <>
              <p className="text-xs text-muted-foreground">{t("saAskOtp")}</p>
              <Input className="text-center font-mono text-xl tracking-[0.5em]" inputMode="numeric" maxLength={4} placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            </>
          )}
          <Button className="w-full" disabled={busy || (step.otp && otp.length !== 4)} onClick={run}>
            {busy ? "…" : step.label}
          </Button>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
