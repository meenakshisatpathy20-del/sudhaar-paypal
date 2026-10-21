"use client";

import { rupees } from "@/components/Inr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Leaf, PiggyBank, Wrench } from "lucide-react";
import { api } from "@/components/api";
import { CATEGORY_ICON } from "@/components/CategoryIcon";
import { useLang } from "@/components/LanguageProvider";
import { STATUS_PROGRESS, StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AVG_ITEM_KG } from "@/lib/pricing";
import type { Order } from "@/lib/types";

type Resp = { orders: Order[]; quotes: Record<string, { newPrice: number; photo?: string }>; karigars: Record<string, { name: string; shop: string; avatarColor: string }> };

export default function Repairs() {
  const { t } = useLang();
  const [data, setData] = useState<Resp | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Keep the last good data on a failed refresh; never show "no repairs" just because the network dropped.
    const load = () =>
      api<Resp>("/api/orders")
        .then((d) => {
          setData(d);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);

  const orders = data?.orders ?? [];
  const active = orders.filter((o) => o.status !== "paid_out" && o.status !== "cancelled");
  const done = orders.filter((o) => o.status === "paid_out");
  const empty = !data ? failed ? <Empty text={t("loadFailed")} cta="" /> : <Card className="h-32 animate-pulse" /> : <Empty text={t("noRepairs")} cta={t("fixSomething")} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold">{t("repairsTitle")}</h1>
        <p className="text-xs text-muted-foreground">{t("demoShared")}</p>
      </div>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            {t("active")} ({active.length})
          </TabsTrigger>
          <TabsTrigger value="passports">
            {t("passports")} ({done.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {active.length === 0 && empty}
          {active.map((o) => {
            const Icon = CATEGORY_ICON[o.category];
            const k = data?.karigars[o.karigarId];
            return (
              <Link key={o.id} href={`/orders/${o.id}`}>
                <Card className="transition hover:bg-muted">
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{o.kind === "basket" && o.jobs ? t("oBasketTitle", { n: o.jobs.length }) : o.item}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {k?.shop} · {rupees(o.total)} · {o.id}
                        </p>
                      </div>
                      <StatusPill status={o.status} />
                    </div>
                    <Progress value={STATUS_PROGRESS[o.status]} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </TabsContent>
        <TabsContent value="passports" className="grid gap-3 sm:grid-cols-2">
          {done.length === 0 && empty}
          {done.map((o) => {
            const q = data?.quotes[o.quoteId];
            const k = data?.karigars[o.karigarId];
            const saved = q && q.newPrice > 0 ? Math.max(0, q.newPrice - o.repairCharge) : 0;
            return (
              <Link key={o.id} href={`/orders/${o.id}`}>
                <Card className="relative h-full overflow-hidden bg-gradient-to-br from-marigold/15 via-card to-teal/10 transition hover:-translate-y-0.5">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">
                          {t("passportTitle")} · {t("secondLife")}
                        </p>
                        <p className="mt-1 font-display text-lg font-bold">{o.kind === "basket" && o.jobs ? t("oBasketTitle", { n: o.jobs.length }) : o.item}</p>
                      </div>
                      {q?.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/uploads/${o.afterPhoto ?? q.photo}`} alt="" className="size-14 rounded-xl object-cover ring-1 ring-border" />
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1.5">
                        <PiggyBank className="size-4 text-gold" /> {rupees(saved)} {t("savedLabel")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Leaf className="size-4 text-primary" /> {AVG_ITEM_KG[o.category]} kg
                      </span>
                    </div>
                    {k && (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar name={k.name} color={k.avatarColor} className="size-6 rounded-lg text-[9px]" /> {t("fixedBy")} {k.name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta: string }) {
  return (
    <Card className="sm:col-span-2">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Wrench className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">{text}</p>
        {cta && (
          <Button asChild>
            <Link href="/fix">
              {cta} <ArrowRight />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
