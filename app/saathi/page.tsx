"use client";

import Link from "next/link";
import { useState } from "react";
import { api, money } from "@/components/api";
import { StatusPill } from "@/components/StatusPill";
import { useOrders } from "@/components/useOrders";
import type { Order } from "@/lib/types";

export default function SaathiApp() {
  const { orders, reload } = useOrders();
  const jobs = orders.filter((o) => o.mode === "pickup" && ["authorized", "picked_up", "repaired", "out_for_delivery"].includes(o.status));
  const earned = orders.flatMap((o) => o.payouts.filter((p) => p.to === "saathi")).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card bg-gradient-to-br from-brand to-[#14958a] text-white">
        <p className="text-sm text-teal-50">Repair Saathi app</p>
        <p className="text-2xl font-extrabold">{money(earned)} earned</p>
        <p className="text-xs text-teal-50">75% of every pickup fee, paid instantly to your PayPal when the customer confirms delivery.</p>
      </div>
      {jobs.length === 0 && <p className="card text-sm text-muted">No pickups or deliveries right now. Book a repair from the Customer tab.</p>}
      {jobs.map((o) => (
        <SaathiJob key={o.id} order={o} onDone={reload} />
      ))}
    </div>
  );
}

function SaathiJob({ order, onDone }: { order: Order; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step =
    order.status === "authorized"
      ? { action: "pickup", label: "Verify pickup OTP & collect", otp: true }
      : order.status === "picked_up"
        ? { action: "drop_at_karigar", label: "Handed to karigar", otp: false }
        : order.status === "repaired"
          ? { action: "out_for_delivery", label: "Collect from karigar & go", otp: false }
          : { action: "deliver", label: "Verify delivery OTP & hand over", otp: true };

  async function run() {
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
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/orders/${order.id}`} className="font-mono text-xs text-muted hover:text-brand">
            {order.id}
          </Link>
          <p className="font-semibold">{order.item}</p>
          <p className="text-xs text-muted">
            {order.customer.name} · {order.customer.address} · {order.distanceKm} km · you earn {money(order.split.saathi)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      {step.otp && (
        <input className="input text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
      )}
      <button className="btn w-full" disabled={busy || (step.otp && otp.length !== 4)} onClick={run}>
        {busy ? (step.action === "deliver" ? "Capturing payment & paying out…" : "Updating…") : step.label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
