"use client";

import { RequireLogin } from "@/components/LoginSheet";
import { useSession } from "@/components/SessionProvider";
import { orderRupees, rupees } from "@/components/Inr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, HeartHandshake, Leaf, MessageCircleMore, PiggyBank, RotateCcw, ShoppingBasket, Wrench } from "lucide-react";
import { SlotLine } from "@/components/SlotLine";
import { CARE_PRICE_USD } from "@/lib/pricing";
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
  return (
    <RequireLogin>
      <RepairsInner />
    </RequireLogin>
  );
}

function RepairsInner() {
  const { t } = useLang();
  const { account } = useSession();
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

  const savedTotal = done.reduce((s, o) => {
    const q = data?.quotes[o.quoteId];
    return s + (q && q.newPrice > 0 ? Math.max(0, q.newPrice - o.repairCharge) : 0);
  }, 0);
  const kgTotal = done.reduce((s, o) => s + (o.jobs?.length ? o.jobs.reduce((a, j) => a + AVG_ITEM_KG[j.category], 0) : AVG_ITEM_KG[o.category]), 0);

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-3xl font-bold">{t("repairsTitle")}</h1>
        {account?.demo && <p className="text-xs text-muted-foreground">{t("demoShared")}</p>}
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
        <TabsContent value="active" className="grid gap-3 xl:grid-cols-2">
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
                          {k?.shop} · {orderRupees(o)} · {o.id}
                        </p>
                      </div>
                      <StatusPill status={o.status} />
                    </div>
                    {!["delivered", "cancelled"].includes(o.status) && <SlotLine order={o} className="text-xs" />}
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
              <div key={o.id}>
                <Card className="relative h-full overflow-hidden bg-gradient-to-br from-marigold/15 via-card to-teal/10 transition hover:-translate-y-0.5">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">
                          {t("passportTitle")} · {t("secondLife")}
                        </p>
                        {/* The title link covers the whole card; "Book again" sits above it. */}
                        <Link href={`/orders/${o.id}`} className="mt-1 block font-display text-lg font-bold after:absolute after:inset-0">
                          {o.kind === "basket" && o.jobs ? t("oBasketTitle", { n: o.jobs.length }) : o.item}
                        </Link>
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
                    <div className="flex items-center justify-between gap-2">
                      {k && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar name={k.name} color={k.avatarColor} className="size-6 rounded-lg text-[9px]" /> {t("fixedBy")} {k.name}
                        </p>
                      )}
                      {o.kind !== "basket" && (
                        <Link href={`/fix?d=${encodeURIComponent(o.issue)}&c=${o.category}&k=${o.karigarId}`} className="relative z-10 flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary ring-1 ring-border hover:bg-muted">
                          <RotateCcw className="size-3.5" /> {t("bookAgain")}
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
    <aside className="space-y-4 lg:sticky lg:top-24">
      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("rpImpact")}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/60 p-2">
              <Wrench className="mx-auto size-4 text-primary" />
              <p className="font-display text-lg font-bold">{done.length}</p>
              <p className="text-[10px] text-muted-foreground">{t("rpFixed")}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <PiggyBank className="mx-auto size-4 text-gold" />
              <p className="font-display text-lg font-bold">{rupees(savedTotal)}</p>
              <p className="text-[10px] text-muted-foreground">{t("savedLabel")}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <Leaf className="mx-auto size-4 text-teal" />
              <p className="font-display text-lg font-bold">{kgTotal.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">kg</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Link href="/care" className={account?.care ? "block rounded-2xl bg-teal/10 p-4 text-sm ring-1 ring-teal/25" : "block rounded-2xl bg-teal/10 p-4 text-sm ring-1 ring-teal/25 hover:bg-teal/15"}>
        <p className="flex items-center gap-2 font-semibold text-teal">
          <HeartHandshake className="size-4" /> Sudhaar Care
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{account?.care ? t("rpCareOn") : t("careUpsell", { price: rupees(CARE_PRICE_USD) })}</p>
      </Link>
      <Card>
        <CardContent className="grid gap-2">
          <Button asChild>
            <Link href="/fix">
              <Wrench /> {t("fixSomething")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/ghar-safai">
              <ShoppingBasket /> {t("ftGhar")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agent">
              <MessageCircleMore /> {t("navTalk")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </aside>
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta: string }) {
  return (
    <Card className="sm:col-span-2 xl:col-span-2">
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
