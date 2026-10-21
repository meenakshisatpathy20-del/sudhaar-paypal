"use client";

import { rupees } from "@/components/Inr";
import { useEffect, useState } from "react";
import { Handshake, Leaf, MapPin, PiggyBank, ShieldCheck, Volume2, Wrench } from "lucide-react";
import { api } from "@/components/api";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/components/LanguageProvider";
import { ModeBadges } from "@/components/ModeBadges";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

export default function Profile() {
  const { t, speakReplies, setSpeakReplies } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [impact, setImpact] = useState<{ itemsRepaired: number; kgSaved: number; moneySaved: number; karigarEarnings: number } | null>(null);
  useEffect(() => {
    api<{ orders: Order[] }>("/api/orders").then((r) => setOrders(r.orders)).catch(() => {});
    api<{ impact: typeof impact }>("/api/admin").then((r) => setImpact(r.impact)).catch(() => {});
  }, []);
  const customer = orders[0]?.customer ?? { name: "Anita Sharma", address: "Flat 12, Lake View Apartments" };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 to-card">
        <CardContent className="flex items-center gap-4">
          <Avatar name={customer.name} color="#0f766e" className="size-16 text-lg" />
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" /> {customer.address}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("demoProfile")}</p>
          </div>
        </CardContent>
      </Card>

      {impact && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-bold">{t("yourImpact")}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: Wrench, v: String(impact.itemsRepaired), l: t("impactItems") },
                { icon: Leaf, v: `${impact.kgSaved}`, l: t("impactKg") },
                { icon: PiggyBank, v: rupees(impact.moneySaved), l: t("impactSaved") },
                { icon: Handshake, v: rupees(impact.karigarEarnings), l: t("impactKarigar") },
              ].map((x) => (
                <div key={x.l} className="rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
                  <x.icon className="size-4 text-gold" />
                  <p className="mt-1 font-display text-xl font-bold">{x.v}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{x.l}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-medium">{t("language")}</span>
            <LangToggle />
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Volume2 className="size-4 text-primary" /> {t("voiceReplies")}
            </span>
            <button
              role="switch"
              aria-checked={speakReplies}
              onClick={() => setSpeakReplies(!speakReplies)}
              className={cn("relative h-6 w-11 rounded-full transition", speakReplies ? "bg-primary" : "bg-input")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition", speakReplies ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-[#0050b3]" /> Payments
            </span>
            <ModeBadges />
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
