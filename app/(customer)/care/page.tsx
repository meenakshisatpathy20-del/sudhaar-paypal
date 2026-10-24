"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CalendarClock, HeartHandshake, Repeat, ShieldCheck, Truck } from "lucide-react";
import { api } from "@/components/api";
import { rupees } from "@/components/Inr";
import { useLang } from "@/components/LanguageProvider";
import { LoginSheet } from "@/components/LoginSheet";
import { useSession } from "@/components/SessionProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { langMeta } from "@/lib/i18n";
import type { CareMembership } from "@/lib/types";

type CareInfo = { priceUsd: number; benefits: string[]; mode: "sandbox" | "simulated"; membership: CareMembership | null };

export default function CarePage() {
  return (
    <Suspense fallback={null}>
      <Care />
    </Suspense>
  );
}

// Sudhaar Care: a monthly plan billed with PayPal Subscriptions (catalog product -> billing plan ->
// subscription). The customer approves it on PayPal and can cancel here at any time.
function Care() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const { account, refresh } = useSession();
  const [info, setInfo] = useState<CareInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const load = useCallback(() => {
    api<CareInfo>("/api/care").then(setInfo).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    refresh();
  }, [load, refresh, account?.id]);

  async function subscribe(afterLogin?: unknown) {
    if (account?.role !== "customer" && afterLogin !== true) {
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ approveUrl: string }>("/api/care", { action: "subscribe" });
      window.location.href = r.approveUrl;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function cancel() {
    if (!window.confirm(t("careCancelConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/care", { action: "cancel" });
      load();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const status = params.get("status");
  const m = info?.membership;
  const active = m?.status === "ACTIVE";
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(langMeta(lang).locale, { day: "numeric", month: "short", year: "numeric" }) : "—");
  const perks: [typeof Truck, string, string][] = [
    [Truck, t("carePerk1"), t("carePerk1Sub")],
    [ShieldCheck, t("carePerk2"), t("carePerk2Sub")],
    [HeartHandshake, t("carePerk3"), t("carePerk3Sub")],
  ];

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="space-y-5">
        <div className="paper relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal/15 via-card to-marigold/15 p-6 sm:p-8">
          <Badge variant="outline">{t("careKicker")}</Badge>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight">Sudhaar Care</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{t("careSub")}</p>
          <p className="mt-5 font-display text-4xl font-bold">
            {info ? rupees(info.priceUsd) : "…"}
            <span className="text-base font-medium text-muted-foreground"> / {t("careMonth")}</span>
          </p>
          {info && <p className="text-xs text-muted-foreground">{t("careUsd", { amount: `$${info.priceUsd.toFixed(2)}` })}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {perks.map(([Icon, title, sub]) => (
            <Card key={title}>
              <CardContent className="space-y-1.5">
                <Icon className="size-6 text-teal" />
                <p className="font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <h2 className="flex items-center gap-2 font-bold">
              <Repeat className="size-4 text-primary" /> {t("careHow")}
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>{t("careHow1")}</li>
              <li>{t("careHow2")}</li>
              <li>{t("careHow3")}</li>
              <li>{t("careHow4")}</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4 lg:sticky lg:top-24">
        {status === "active" && <p className="rounded-2xl bg-teal/10 p-3 text-sm font-semibold text-teal ring-1 ring-teal/25">{t("careWelcome")}</p>}
        {status === "pending" && <p className="rounded-2xl bg-marigold/15 p-3 text-sm text-gold">{t("carePending")}</p>}
        {status === "cancelled" && !active && <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{t("careNotDone")}</p>}
        {status === "error" && <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{params.get("msg")}</p>}
        <Card className={active ? "ring-2 ring-teal" : "ring-1 ring-[#0070e0]/40"}>
          <CardContent className="space-y-4">
            {active && m ? (
              <>
                <p className="flex items-center gap-2 text-lg font-bold text-teal">
                  <BadgeCheck className="size-5" /> {t("careActive")}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">{t("careSince")}</dt>
                  <dd>{date(m.startedAt)}</dd>
                  <dt className="text-muted-foreground">{t("careNext")}</dt>
                  <dd className="flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-primary" /> {date(m.nextBillingAt)}
                  </dd>
                  <dt className="text-muted-foreground">PayPal</dt>
                  <dd className="break-all font-mono text-xs">{m.subscriptionId}</dd>
                </dl>
                <p className="text-xs text-muted-foreground">{t("careAppliesAuto")}</p>
                <Button variant="outline" className="w-full" disabled={busy} onClick={cancel}>
                  {t("careCancel")}
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">{t("careJoin")}</h2>
                {m?.status === "CANCELLED" && <p className="text-xs text-muted-foreground">{t("careWasCancelled")}</p>}
                <Button size="lg" className="w-full bg-[#ffc439] text-[#111] hover:bg-[#f2b72f]" disabled={busy} onClick={subscribe}>
                  {busy ? "…" : t("careSubscribe")}
                </Button>
                <p className="text-xs text-muted-foreground">{info?.mode === "simulated" ? t("careSim") : t("careSandbox")}</p>
              </>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </section>
      <LoginSheet open={loginOpen} onOpenChange={setLoginOpen} onDone={() => subscribe(true)} />
    </div>
  );
}
