"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { BadgeCheck, HeartHandshake, ShieldCheck } from "lucide-react";
import { api, money } from "@/components/api";
import { HomeHeart } from "@/components/Doodles";
import { Logo } from "@/components/Logo";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Karigar, Order } from "@/lib/types";

// Family Pay: the page a son/daughter opens from WhatsApp to pay for a parent's repair.
export default function FamilyPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ order: Order; karigar?: Karigar } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ order: Order; karigar?: Karigar }>(`/api/orders/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <p className="p-6 text-destructive">{error}</p>;
  if (!data) return null;
  const { order, karigar } = data;
  const fp = order.familyPay;
  const paid = order.status !== "awaiting_payment";

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-4 px-4 py-6">
      <Logo />
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-[#ffe1b8] to-[#d8efe9] p-5 text-center">
          <HomeHeart className="mx-auto w-24" />
          <p className="mt-2 text-sm text-muted-foreground">{fp ? `Hi ${fp.name},` : "Hi,"}</p>
          <h1 className="text-2xl font-bold leading-tight">
            {order.customer.name.split(" ")[0]} needs help paying for a repair at home
          </h1>
        </div>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
            {karigar && <Avatar name={karigar.name} color={karigar.avatarColor} />}
            <div className="min-w-0">
              <p className="font-semibold">{order.item}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {order.kind === "basket" ? order.issue : `${karigar?.shop} · ${karigar?.rating}★`} <BadgeCheck className="size-3.5 shrink-0 text-teal" />
              </p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Repair</span>
              <span>{money(order.repairCharge)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Doorstep pickup & delivery</span>
              <span>{money(order.pickupFee)}</span>
            </p>
            {order.donation > 0 && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">Karigar tool fund</span>
                <span>{money(order.donation)}</span>
              </p>
            )}
            <p className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span>
              <span className="font-display text-lg">{money(order.total)}</span>
            </p>
          </div>
          <p className="flex gap-2 rounded-2xl bg-[#e6f0ff] p-3 text-xs text-paypal-blue">
            <ShieldCheck className="size-4 shrink-0" /> PayPal only holds the money. It is captured when the repaired item is delivered back home and confirmed with an OTP.
          </p>
          {!paid && order.paypal.orderId && <PayPalCheckout orderId={order.id} paypalOrderId={order.paypal.orderId} total={order.total} onApproved={load} />}
          {paid && (
            <div className="space-y-2 rounded-2xl bg-teal/10 p-4 text-center">
              <HeartHandshake className="mx-auto size-7 text-teal" />
              <p className="font-semibold">Thank you! The payment is held safely by PayPal.</p>
              <p className="text-xs text-muted-foreground">A Repair Saathi will collect the item. You can follow the repair live.</p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/orders/${order.id}`}>Track the repair</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
