"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, money } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <select className="h-11 w-full rounded-xl border border-input bg-[#0d1514] px-3 text-sm" value={kid} onChange={(e) => setKid(e.target.value)} aria-label="Karigar">
        {karigars.map((x) => (
          <option key={x.id} value={x.id}>
            {x.shop} ({x.name})
          </option>
        ))}
      </select>
      <div className="glass rounded-2xl bg-gradient-to-br from-gold/25 to-transparent p-5">
        <p className="text-sm text-muted-foreground">Namaste, {k?.name.split(" ")[0] ?? "ji"} 🙏</p>
        <p className="font-display text-4xl font-bold">{money(earned)}</p>
        <p className="text-xs text-muted-foreground">You keep 90% of every repair. Paid instantly to PayPal on delivery. No joining fee.</p>
      </div>
      {active.length === 0 && <p className="glass rounded-2xl p-5 text-sm text-muted-foreground">No active jobs. New bookings appear here automatically.</p>}
      {active.map((o) => (
        <KarigarJob key={o.id} order={o} onDone={reload} />
      ))}
      {mine.filter((o) => o.status === "paid_out").length > 0 && (
        <div className="glass rounded-2xl p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Completed</p>
          {mine
            .filter((o) => o.status === "paid_out")
            .map((o) => (
              <p key={o.id} className="flex justify-between border-t border-white/10 py-1.5 text-sm first:border-0">
                <span>{o.item}</span>
                <span className="font-semibold text-primary">+{money(o.payouts.find((p) => p.to === "karigar")?.amount ?? 0)}</span>
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
    <div className="glass space-y-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/orders/${order.id}`} className="font-mono text-xs text-muted-foreground hover:text-primary">
            {order.id}
          </Link>
          <p className="font-semibold">{order.item}</p>
          <p className="text-xs text-muted-foreground">
            {order.issue} · you earn {money(visit ? order.split.karigar + order.split.saathi : order.split.karigar)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      {order.status === "authorized" && !visit && <p className="text-xs text-muted-foreground">Waiting for the Saathi to pick it up.</p>}
      {order.status === "picked_up" && <p className="text-xs text-muted-foreground">Saathi is on the way to you.</p>}
      {(order.status === "at_karigar" || (visit && order.status === "authorized")) && (
        <>
          {visit && (
            <Input className="text-center font-mono tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="Arrival OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          )}
          <Button className="w-full" disabled={busy || (visit && otp.length !== 4)} onClick={() => run("start_repair", { otp })}>
            {visit ? "Verify OTP & start repair" : "Inspect & start repair"}
          </Button>
        </>
      )}
      {order.status === "repairing" && (
        <>
          {order.completionCheck && !order.completionCheck.passed && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">Last check: {order.completionCheck.reasoning}</p>}
          <PhotoPicker compact label="Photo of the repaired item" onUploaded={(f) => setPhoto(f)} />
          <Button className="w-full" disabled={busy || !photo} onClick={() => run("mark_repaired", { afterPhoto: photo })}>
            {busy ? "AI is checking the repair…" : "Mark repaired"}
          </Button>
        </>
      )}
      {order.status === "repaired" && !visit && <p className="text-xs text-muted-foreground">Ready. The Saathi will collect it for delivery.</p>}
      {order.status === "repaired" && visit && (
        <>
          <Input className="text-center font-mono tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="Job-done OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          <Button className="w-full" disabled={busy || otp.length !== 4} onClick={() => run("deliver", { otp })}>
            {busy ? "Capturing payment…" : "Verify OTP & get paid"}
          </Button>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
