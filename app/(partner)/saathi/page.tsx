"use client";

import Link from "next/link";
import { useState } from "react";
import { Bike, MapPin } from "lucide-react";
import { api, money } from "@/components/api";
import { StatusPill } from "@/components/StatusPill";
import { useOrders } from "@/components/useOrders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/types";

export default function SaathiApp() {
  const { orders, reload } = useOrders();
  const jobs = orders.filter((o) => o.mode === "pickup" && ["authorized", "picked_up", "repaired", "out_for_delivery"].includes(o.status));
  const earned = orders.flatMap((o) => o.payouts.filter((p) => p.to === "saathi")).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card className="bg-gradient-to-br from-primary/15 to-card">
        <CardContent className="space-y-1">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bike className="size-4 text-primary" /> Repair Saathi
          </p>
          <p className="font-display text-4xl font-bold">{money(earned)}</p>
          <p className="text-xs text-muted-foreground">75% of every pickup fee, paid instantly to your PayPal when the customer confirms delivery.</p>
        </CardContent>
      </Card>
      {jobs.length === 0 && (
        <Card>
          <CardContent className="text-sm text-muted-foreground">No pickups or deliveries right now. Book a repair from the customer app.</CardContent>
        </Card>
      )}
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
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/orders/${order.id}`} className="font-mono text-xs text-muted-foreground hover:text-primary">
              {order.id}
            </Link>
            <p className="font-semibold">{order.item}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {order.customer.address} · {order.distanceKm} km · earn {money(order.split.saathi)}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>
        {step.otp && <Input className="text-center font-mono text-xl tracking-[0.5em]" inputMode="numeric" maxLength={4} placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />}
        <Button className="w-full" disabled={busy || (step.otp && otp.length !== 4)} onClick={run}>
          {busy ? (step.action === "deliver" ? "Capturing payment & paying out…" : "Updating…") : step.label}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
