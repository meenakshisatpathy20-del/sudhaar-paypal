"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, money } from "@/components/api";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusPill } from "@/components/StatusPill";
import { useOrders } from "@/components/useOrders";
import type { Karigar, Order } from "@/lib/types";

export default function KarigarPage() {
  return (
    <Suspense fallback={null}>
      <KarigarApp />
    </Suspense>
  );
}

function KarigarApp() {
  const params = useSearchParams();
  const { orders, reload } = useOrders();
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [kid, setKid] = useState<string>(params.get("k") ?? "k-ramesh");

  useEffect(() => {
    api<{ karigars: Karigar[] }>("/api/admin").then((r) => setKarigars(r.karigars)).catch(() => {});
  }, []);

  const k = karigars.find((x) => x.id === kid);
  const mine = orders.filter((o) => o.karigarId === kid);
  const active = mine.filter((o) => ["authorized", "picked_up", "at_karigar", "repairing", "repaired"].includes(o.status));
  const earned = mine.flatMap((o) => o.payouts.filter((p) => p.to === "karigar")).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <select className="input" value={kid} onChange={(e) => setKid(e.target.value)} aria-label="Karigar">
        {karigars.map((x) => (
          <option key={x.id} value={x.id}>
            {x.shop} ({x.name})
          </option>
        ))}
      </select>
      <div className="card bg-gradient-to-br from-amber-500 to-amber-600 text-white">
        <p className="text-sm">Namaste, {k?.name.split(" ")[0] ?? "ji"} 🙏</p>
        <p className="text-2xl font-extrabold">{money(earned)} earned</p>
        <p className="text-xs">You keep 90% of every repair. Paid instantly to PayPal on delivery. No joining fee.</p>
      </div>
      {active.length === 0 && <p className="card text-sm text-muted">No active jobs. New bookings appear here automatically.</p>}
      {active.map((o) => (
        <KarigarJob key={o.id} order={o} onDone={reload} />
      ))}
      {mine.filter((o) => o.status === "paid_out").length > 0 && (
        <div className="card">
          <p className="label">Completed</p>
          {mine
            .filter((o) => o.status === "paid_out")
            .map((o) => (
              <p key={o.id} className="flex justify-between border-t border-line py-1.5 text-sm first:border-0">
                <span>{o.item}</span>
                <span className="font-semibold text-brand">+{money(o.payouts.find((p) => p.to === "karigar")?.amount ?? 0)}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function KarigarJob({ order, onDone }: { order: Order; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, extra: Record<string, string | undefined> = {}) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/action`, { action, ...extra });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const visit = order.mode === "home-visit";
  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/orders/${order.id}`} className="font-mono text-xs text-muted hover:text-brand">
            {order.id}
          </Link>
          <p className="font-semibold">{order.item}</p>
          <p className="text-xs text-muted">
            {order.issue} · you earn {money(visit ? order.split.karigar + order.split.saathi : order.split.karigar)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      {order.status === "authorized" && !visit && <p className="text-xs text-muted">Waiting for the Saathi to pick it up.</p>}
      {order.status === "picked_up" && <p className="text-xs text-muted">Saathi is on the way to you.</p>}
      {(order.status === "at_karigar" || (visit && order.status === "authorized")) && (
        <>
          {visit && (
            <input className="input text-center font-mono tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="Arrival OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          )}
          <button className="btn w-full" disabled={busy || (visit && otp.length !== 4)} onClick={() => run("start_repair", { otp })}>
            {visit ? "Verify OTP & start repair" : "Inspect & start repair"}
          </button>
        </>
      )}
      {order.status === "repairing" && (
        <>
          {order.completionCheck && !order.completionCheck.passed && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">Last check: {order.completionCheck.reasoning}</p>}
          <PhotoPicker compact label="Photo of the repaired item" onUploaded={(f) => setPhoto(f)} />
          <button className="btn w-full" disabled={busy || !photo} onClick={() => run("mark_repaired", { afterPhoto: photo })}>
            {busy ? "AI is checking the repair…" : "Mark repaired"}
          </button>
        </>
      )}
      {order.status === "repaired" && !visit && <p className="text-xs text-muted">Ready. The Saathi will collect it for delivery.</p>}
      {order.status === "repaired" && visit && (
        <>
          <input className="input text-center font-mono tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="Job-done OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          <button className="btn w-full" disabled={busy || otp.length !== 4} onClick={() => run("deliver", { otp })}>
            {busy ? "Capturing payment…" : "Verify OTP & get paid"}
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
