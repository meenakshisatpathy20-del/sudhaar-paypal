"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Bot, LifeBuoy, MessagesSquare, Receipt, Search, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { RequireLogin } from "@/components/LoginSheet";
import { useLang } from "@/components/LanguageProvider";
import { ClaimCard, ClaimForm } from "@/components/resolve/Claims";
import { api } from "@/components/api";
import { Input } from "@/components/ui/input";
import { isOpenClaim } from "@/lib/claims-shared";
import { CATEGORY_ICON } from "@/components/CategoryIcon";
import { orderRupees } from "@/components/Inr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useOrders } from "@/components/useOrders";
import { langMeta } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveredAt, warrantyDaysLeft } from "@/lib/warranty";
import type { Complaint, Order } from "@/lib/types";

export default function ResolvePage() {
  return (
    <RequireLogin>
      <Suspense fallback={null}>
        <Resolve />
      </Suspense>
    </RequireLogin>
  );
}

// Resolve Hub: the customer's warranty desk. Raise a claim on a delivered repair (the PayPal invoice is
// attached), see Gemini's review, the Sudhaar team's decision and the PayPal refund id.
function Resolve() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const { orders } = useOrders(5000);
  const [selected, setSelected] = useState<string | null>(params.get("order"));
  useEffect(() => {
    if (params.get("order")) setSelected(params.get("order"));
  }, [params]);

  const [claims, setClaims] = useState<{ claim: Complaint; order: Order }[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const loadClaims = useCallback(() => {
    api<{ claims: { claim: Complaint; order: Order }[] }>("/api/claims")
      .then((r) => setClaims(r.claims))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadClaims();
    const timer = setInterval(loadClaims, 8000);
    return () => clearInterval(timer);
  }, [loadClaims]);

  const delivered = orders.filter((o) => o.paypal.captureId);
  const open = (o: Order) => o.complaints.some(isOpenClaim);
  const eligible = delivered.filter((o) => warrantyDaysLeft(o) >= 0);
  const expired = delivered.filter((o) => warrantyDaysLeft(o) < 0);
  const q = query.trim().toLowerCase();
  const shown = claims.filter(
    ({ claim: c, order: o }) =>
      (filter === "all" || (filter === "open") === isOpenClaim(c)) && (!q || [c.id, o.id, o.item, c.details, t(`oIssue_${c.issue}` as never)].some((x) => x.toLowerCase().includes(q))),
  );
  const openCount = claims.filter((x) => isOpenClaim(x.claim)).length;
  const chosen = eligible.find((o) => o.id === selected && !open(o));
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(langMeta(lang).locale, { day: "numeric", month: "short" }) : "");
  const how: [typeof Receipt, string, string][] = [
    [Receipt, t("rhHow1"), t("rhHow1Sub")],
    [Bot, t("rhHow2"), t("rhHow2Sub")],
    [UserCheck, t("rhHow3"), t("rhHow3Sub")],
    [Wallet, t("rhHow4"), t("rhHow4Sub")],
  ];

  return (
    <div className="space-y-6">
      <section className="paper rounded-3xl bg-gradient-to-br from-marigold/15 via-card to-teal/10 p-6 md:p-8">
        <Badge variant="outline">
          <LifeBuoy /> {t("rhKicker")}
        </Badge>
        <h1 className="mt-3 font-display text-4xl font-bold">Resolve Hub</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t("rhSub")}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {how.map(([Icon, title, sub], i) => (
            <div key={title} className="rounded-2xl bg-card/80 p-3 ring-1 ring-border">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{i + 1}</span>
                <Icon className="size-4 text-primary" /> {title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <MessagesSquare className="size-5 text-primary" /> {t("rhYourClaims")}
            </h2>
            <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
              {(["all", "open", "closed"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5", filter === f ? "bg-card shadow-sm" : "text-muted-foreground")}>
                  {f === "all" ? t("rhAll", { n: claims.length }) : f === "open" ? t("rhOpenN", { n: openCount }) : t("rhClosedN", { n: claims.length - openCount })}
                </button>
              ))}
            </div>
          </div>
          {claims.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("rhSearch")} className="pl-9" />
            </div>
          )}
          {claims.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("rhNoClaims")}</p>}
          {claims.length > 0 && shown.length === 0 && <p className="paper rounded-2xl p-5 text-sm text-muted-foreground">{t("rhNoMatch")}</p>}
          {shown.map(({ order, claim }) => (
            <ClaimCard key={claim.id} order={order} claim={claim} />
          ))}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="ring-1 ring-primary/30">
            <CardContent className="space-y-3">
              <h2 className="font-bold">{t("rhRaise")}</h2>
              {eligible.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("rhNothingEligible")}{" "}
                  <Link href="/repairs" className="font-semibold text-primary underline">
                    {t("navRepairs")}
                  </Link>
                </p>
              )}
              {eligible.length > 0 && <p className="text-xs text-muted-foreground">{t("rhPick")}</p>}
              <div className="space-y-2">
                {eligible.map((o) => {
                  const Icon = CATEGORY_ICON[o.category];
                  const left = warrantyDaysLeft(o);
                  const busy = open(o);
                  return (
                    <button
                      key={o.id}
                      disabled={busy}
                      onClick={() => setSelected(o.id)}
                      className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition disabled:opacity-60", selected === o.id && !busy ? "bg-primary/10 ring-primary" : "ring-border hover:bg-muted")}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{o.kind === "basket" && o.jobs ? t("oBasketTitle", { n: o.jobs.length }) : o.item}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {orderRupees(o)} · {t("rhDelivered", { date: date(deliveredAt(o)) })}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", busy ? "bg-marigold/20 text-[#7a4a06]" : "bg-teal/15 text-teal")}>
                        {busy ? t("rhUnderReview") : t("rhDaysLeft", { n: left })}
                      </span>
                    </button>
                  );
                })}
              </div>
              {chosen && (
                <div className="border-t border-border pt-3">
                  <ClaimForm key={chosen.id} order={chosen} onCancel={() => setSelected(null)} />
                </div>
              )}
              {expired.length > 0 && <p className="text-[11px] text-muted-foreground">{t("rhExpired", { n: expired.length })}</p>}
            </CardContent>
          </Card>
          <div className="paper space-y-2 rounded-2xl p-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4 text-teal" /> {t("rhPolicy")}
            </p>
            <p>{t("rhPolicy1", { days: 15, careDays: 30 })}</p>
            <p>{t("rhPolicy2")}</p>
            <p>{t("rhPolicy3")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
