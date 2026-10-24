"use client";

import { rupees } from "@/components/Inr";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Compass, Handshake, HeartHandshake, KeyRound, Leaf, LifeBuoy, Loader2, LocateFixed, LogOut, MapPin, MessageCircleMore, PiggyBank, ShieldCheck, UserRound, Volume2, Wallet, Wrench } from "lucide-react";
import { api } from "@/components/api";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/components/LanguageProvider";
import { RequireLogin } from "@/components/LoginSheet";
import { ModeBadges } from "@/components/ModeBadges";
import { useSession } from "@/components/SessionProvider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocate } from "@/components/useGeolocate";
import { AVG_ITEM_KG, CARE_PRICE_USD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { langMeta } from "@/lib/i18n";
import type { CareMembership, Order } from "@/lib/types";

export default function Profile() {
  return (
    <RequireLogin>
      <ProfileInner />
    </RequireLogin>
  );
}

type Resp = { orders: Order[]; quotes: Record<string, { newPrice: number }> };
type CareInfo = { membership: CareMembership | null; priceUsd: number };

function ProfileInner() {
  const { t, lang, speakReplies, setSpeakReplies } = useLang();
  const { account, logout } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [care, setCare] = useState<CareInfo | null>(null);
  useEffect(() => {
    api<Resp>("/api/orders").then(setData).catch(() => {});
    api<CareInfo>("/api/care").then(setCare).catch(() => {});
  }, []);
  // This customer's own impact and payments, from their orders.
  const orders = data?.orders ?? [];
  const done = orders.filter((o) => o.paypal.captureId);
  const items = done.flatMap((o) => (o.jobs?.length ? o.jobs.map((j) => ({ category: j.category, price: j.price, newPrice: j.newPrice })) : [{ category: o.category, price: o.repairCharge, newPrice: data?.quotes[o.quoteId]?.newPrice ?? 0 }]));
  const impact = {
    itemsRepaired: items.length,
    kgSaved: Math.round(items.reduce((s, i) => s + AVG_ITEM_KG[i.category], 0) * 10) / 10,
    moneySaved: items.reduce((s, i) => s + Math.max(0, i.newPrice - i.price), 0),
    karigarEarnings: done.reduce((s, o) => s + o.payouts.filter((p) => p.to === "karigar").reduce((a, p) => a + p.amount, 0), 0),
  };
  const paid = done.reduce((s, o) => s + o.total, 0);
  const refunded = orders.reduce((s, o) => s + o.paypal.refunds.reduce((a, r) => a + r.amount, 0), 0);
  const invoices = done.filter((o) => o.paypal.invoiceId);
  const payer = done.find((o) => o.customer.email && !o.customer.email.endsWith("@example.com"))?.customer.email;
  const openClaims = orders.reduce((s, o) => s + o.complaints.filter((c) => !c.resolution).length, 0);
  if (!account) return null;
  const since = account.createdAt ? new Date(account.createdAt).toLocaleDateString(langMeta(lang).locale, { month: "long", year: "numeric" }) : "";
  const m = care?.membership;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-card to-teal/10 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={account.name} color="#0f766e" className="size-16 text-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
                {account.name}
                {account.care && (
                  <span className="flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-xs font-semibold text-teal">
                    <HeartHandshake className="size-3.5" /> Sudhaar Care
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {account.phone}
                {since && ` · ${t("pfSince", { date: since })}`}
              </p>
              {account.address && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" /> {account.address}
                </p>
              )}
              {account.demo && <p className="mt-1 text-[11px] text-muted-foreground">{t("demoProfile")}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                router.push("/");
              }}
            >
              <LogOut /> {t("logout")}
            </Button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Wrench, v: String(impact.itemsRepaired), l: t("impactItems") },
              { icon: Leaf, v: `${impact.kgSaved}`, l: t("impactKg") },
              { icon: PiggyBank, v: rupees(impact.moneySaved), l: t("impactSaved") },
              { icon: Handshake, v: rupees(impact.karigarEarnings), l: t("impactKarigar") },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-card/80 p-3 ring-1 ring-border">
                <x.icon className="size-4 text-gold" />
                <p className="mt-1 font-display text-xl font-bold">{x.v}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">{x.l}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <DetailsCard />
          <LocationCard />
          <SecurityCard />
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-bold">
                <HeartHandshake className="size-4 text-teal" /> Sudhaar Care
              </h2>
              {m?.status === "ACTIVE" ? (
                <>
                  <p className="text-sm">{t("rpCareOn")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("careNext")}: {m.nextBillingAt ? new Date(m.nextBillingAt).toLocaleDateString(langMeta(lang).locale) : "—"} · <span className="font-mono">{m.subscriptionId}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("careUpsell", { price: rupees(care?.priceUsd ?? CARE_PRICE_USD) })}</p>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/care">{m?.status === "ACTIVE" ? t("pfManageCare") : t("careJoin")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-bold">
                <Wallet className="size-4 text-[#0050b3]" /> {t("pfPayments")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("pfPaymentsSub")}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/60 p-2">
                  <p className="font-display text-lg font-bold">{rupees(paid)}</p>
                  <p className="text-[10px] text-muted-foreground">{t("pfPaid")}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-2">
                  <p className="font-display text-lg font-bold">{rupees(refunded)}</p>
                  <p className="text-[10px] text-muted-foreground">{t("oRefunded")}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-2">
                  <p className="font-display text-lg font-bold">{invoices.length}</p>
                  <p className="text-[10px] text-muted-foreground">{t("pfInvoices")}</p>
                </div>
              </div>
              {payer && <p className="text-xs text-muted-foreground">{t("pfPayer", { email: payer })}</p>}
              {invoices.length > 0 && (
                <ul className="divide-y divide-border text-sm">
                  {invoices.slice(0, 4).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                      <Link href={`/orders/${o.id}`} className="truncate hover:text-primary">
                        {o.kind === "basket" && o.jobs ? t("oBasketTitle", { n: o.jobs.length }) : o.item}
                      </Link>
                      {o.paypal.invoiceUrl ? (
                        <a href={o.paypal.invoiceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-primary underline">
                          {t("pfInvoice")}
                        </a>
                      ) : (
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{o.paypal.invoiceId}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-xs text-muted-foreground">{t("payments")}</span>
                <ModeBadges />
              </div>
            </CardContent>
          </Card>

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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="font-bold">{t("pfHelp")}</h2>
              <Link href="/resolve" className="flex items-center justify-between rounded-xl p-2 text-sm hover:bg-muted">
                <span className="flex items-center gap-2">
                  <LifeBuoy className="size-4 text-gold" /> Resolve Hub
                </span>
                {openClaims > 0 && <span className="rounded-full bg-marigold/20 px-2 text-xs font-semibold text-[#7a4a06]">{t("pfOpenClaims", { n: openClaims })}</span>}
              </Link>
              <Link href="/agent" className="flex items-center gap-2 rounded-xl p-2 text-sm hover:bg-muted">
                <MessageCircleMore className="size-4 text-primary" /> {t("navTalk")}
              </Link>
              <Link href="/guide" className="flex items-center gap-2 rounded-xl p-2 text-sm hover:bg-muted">
                <Compass className="size-4 text-teal" /> {t("ftGuide")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Name (and phone, which is the login and can't change here). */
function DetailsCard() {
  const { t } = useLang();
  const { account, refresh } = useSession();
  const [name, setName] = useState(account?.name ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <UserRound className="size-4 text-primary" /> {t("pfDetails")}
        </h2>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">{t("joinName")}</span>
          <Input value={name} onChange={(e) => (setName(e.target.value), setMsg(null))} autoComplete="name" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">{t("pfPhone")}</span>
          <Input value={account?.phone ?? ""} disabled />
        </label>
        <Button
          size="sm"
          disabled={busy || !name.trim() || name.trim() === account?.name}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/me", { name });
              await refresh();
              setMsg({ ok: true, text: t("ptSaved") });
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("ptSave")}
        </Button>
        {msg && <p className={cn("text-xs", msg.ok ? "text-teal" : "text-destructive")}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

function SecurityCard() {
  const { t } = useLang();
  const { account } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pin = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <KeyRound className="size-4 text-primary" /> {t("pfSecurity")}
        </h2>
        {account?.demo ? (
          <p className="text-xs text-muted-foreground">{t("pfDemoPin")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder={t("pfPinNow")} aria-label={t("pfPinNow")} type="password" inputMode="numeric" value={current} onChange={(e) => setCurrent(pin(e.target.value))} autoComplete="current-password" />
              <Input placeholder={t("pfPinNew")} aria-label={t("pfPinNew")} type="password" inputMode="numeric" value={next} onChange={(e) => setNext(pin(e.target.value))} autoComplete="new-password" />
            </div>
            <Button
              size="sm"
              disabled={busy || current.length !== 4 || next.length !== 4}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/api/me/pin", { current, next });
                  setCurrent("");
                  setNext("");
                  setMsg({ ok: true, text: t("pfPinChanged") });
                } catch (e) {
                  setMsg({ ok: false, text: (e as Error).message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("pfChangePin")}
            </Button>
          </>
        )}
        {msg && <p className={cn("text-xs", msg.ok ? "text-teal" : "text-destructive")}>{msg.text}</p>}
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {t("pfSecurityNote")}
        </p>
      </CardContent>
    </Card>
  );
}

/** Where this customer's pickups start and maps are centred: the device location plus an editable address. */
function LocationCard() {
  const { t } = useLang();
  const { account, refresh } = useSession();
  const geo = useGeolocate();
  const [address, setAddress] = useState(account?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const at = coords ?? (account?.lat !== undefined && account?.lng !== undefined ? { lat: account.lat, lng: account.lng } : null);

  async function save(next: { lat: number; lng: number } | null) {
    if (!next) return;
    setState("saving");
    setError(null);
    try {
      await api("/api/me/location", { ...next, address });
      await refresh();
      setState("saved");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <Card id="location">
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <MapPin className="size-4 text-primary" /> {t("locTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{at ? t("locLive") : t("locDemo")}</p>
        <Input placeholder={t("fAddress")} value={address} onChange={(e) => (setAddress(e.target.value), setState("idle"))} autoComplete="street-address" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left"
            disabled={geo.busy || state === "saving"}
            onClick={async () => {
              const p = await geo.locate();
              if (p) {
                setCoords(p);
                await save(p);
              }
            }}
          >
            {geo.busy ? <Loader2 className="animate-spin" /> : <LocateFixed />} {geo.busy ? t("locLocating") : t("locUseMine")}
          </Button>
          {at && (
            <Button size="sm" disabled={state === "saving" || !address.trim() || address.trim() === account?.address} onClick={() => save(at)}>
              {t("locSave")}
            </Button>
          )}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-teal">
              <Check className="size-3.5" /> {t("locSaved")}
            </span>
          )}
        </div>
        {at && <p className="font-mono text-[11px] text-muted-foreground">{at.lat.toFixed(4)}, {at.lng.toFixed(4)}</p>}
        {(geo.error || error) && <p className="text-xs text-destructive">{geo.error ?? error}</p>}
      </CardContent>
    </Card>
  );
}
