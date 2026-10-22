"use client";

import { use, useCallback, useEffect, useState } from "react";
import { BadgeCheck, HeartHandshake, ShieldCheck } from "lucide-react";
import { api } from "@/components/api";
import { HomeHeart } from "@/components/Doodles";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";
import { StatusPill } from "@/components/StatusPill";
import { Timeline } from "@/components/Timeline";
import { rupees, rupeeTotal, UsdNote } from "@/components/Inr";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { Karigar, Order } from "@/lib/types";

// Family Pay: the page a son/daughter opens from WhatsApp to pay for a parent's repair.
export default function FamilyPayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = use(params);
  // The secret token from the WhatsApp link: it lets this relative see and pay this one order.
  const token = use(searchParams).t ?? "";
  const [data, setData] = useState<{ order: Order; karigar?: Karigar } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLang();
  const load = useCallback(() => {
    api<{ order: Order; karigar?: Karigar }>(`/api/pay/${id}?t=${encodeURIComponent(token)}`).then(setData).catch((e) => setError(e.message));
  }, [id, token]);
  useEffect(() => {
    load();
    // Keep the relative's view live: they can follow the repair from this page.
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="p-6 text-destructive">{error}</p>;
  if (!data) return null;
  const { order, karigar } = data;
  const fp = order.familyPay;
  const repairs = order.jobs?.length ? order.jobs.map((j) => j.price) : [order.repairCharge];
  const expired = order.status === "cancelled";
  const paid = !expired && order.status !== "awaiting_payment";

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <LangToggle />
      </div>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-[#ffe1b8] to-[#d8efe9] p-5 text-center">
          <HomeHeart className="mx-auto w-24" />
          <p className="mt-2 text-sm text-muted-foreground">{fp ? t("fpHi", { name: fp.name }) : t("fpHiAnon")}</p>
          <h1 className="text-2xl font-bold leading-tight">
            {t("fpHeadline", { name: order.customer.name.split(" ")[0] })}
          </h1>
        </div>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
            {karigar && <Avatar name={karigar.name} color={karigar.avatarColor} />}
            <div className="min-w-0">
              <p className="font-semibold">{order.kind === "basket" && order.jobs ? t("oBasketTitle", { n: order.jobs.length }) : order.item}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {order.kind === "basket" ? order.issue : `${karigar?.shop} · ${karigar?.ratingCount ? `${karigar.rating}★` : t("newKarigar")}`} {karigar?.onboarded && <BadgeCheck className="size-3.5 shrink-0 text-teal" />}
              </p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">{t("oRepair")}</span>
              <span>{rupeeTotal(...repairs)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">{order.kind === "basket" ? t("gharOneTrip") : t("fpPickup")}</span>
              <span>{rupees(order.pickupFee)}</span>
            </p>
            {order.donation > 0 && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">{t("oToolFund")}</span>
                <span>{rupees(order.donation)}</span>
              </p>
            )}
            <p className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>{t("oTotal")}</span>
              <span className="text-right">
                <span className="block font-display text-lg">{rupeeTotal(...repairs, order.pickupFee, order.donation)}</span>
                <UsdNote usd={order.total} />
              </span>
            </p>
          </div>
          <p className="flex gap-2 rounded-2xl bg-[#e6f0ff] p-3 text-xs text-paypal-blue">
            <ShieldCheck className="size-4 shrink-0" /> {t("fpHold")}
          </p>
          {expired && (
            <p className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
              {t("fpExpired", { name: order.customer.name.split(" ")[0] })}
            </p>
          )}
          {!paid && !expired && order.paypal.orderId && <PayPalCheckout orderId={order.id} paypalOrderId={order.paypal.orderId} total={order.total} onApproved={load} token={token} />}
          {paid && (
            <div className="space-y-2 rounded-2xl bg-teal/10 p-4 text-center">
              <HeartHandshake className="mx-auto size-7 text-teal" />
              <p className="font-semibold">{t("fpThanks")}</p>
              <p className="text-xs text-muted-foreground">{t("fpThanksSub")}</p>
            </div>
          )}
          {paid && (
            <div className="space-y-3 rounded-2xl p-3 ring-1 ring-border">
              <p className="flex items-center justify-between font-semibold">
                {t("fpTrack")} <StatusPill status={order.status} />
              </p>
              <Timeline order={order} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
