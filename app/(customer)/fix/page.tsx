"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Clock, KeyRound, List, Map as MapIcon, Recycle, ShieldCheck, Sparkles, Star, Truck, Wallet } from "lucide-react";
import { CouponBox, type AppliedCoupon } from "@/components/CouponBox";
import { LoginSheet } from "@/components/LoginSheet";
import { useSession } from "@/components/SessionProvider";
import { api } from "@/components/api";
import { CategoryChips } from "@/components/CategoryChips";
import { useAppConfig } from "@/components/useAppConfig";
import { FamilyPayPicker, type FamilyPayValue } from "@/components/FamilyPay";
import { FixMeter } from "@/components/FixMeter";
import { rupees, rupeeTotal, UsdNote } from "@/components/Inr";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { MicButton } from "@/components/MicButton";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SlotPicker } from "@/components/SlotPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catExKey, catKey } from "@/lib/i18n";
import { CARE_PRICE_USD, CATEGORY_LABEL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Category, Karigar, Order, PickupSlot, Quote } from "@/lib/types";

type Offer = { karigar: Karigar; distanceKm: number; price: number; pickupFee: number; total: number; readyInDays: number; best?: boolean };

export default function FixPage() {
  return (
    <Suspense fallback={null}>
      <Fix />
    </Suspense>
  );
}

function Fix() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<string>();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const cfg = useAppConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<(Quote & { warning?: string }) | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [donate, setDonate] = useState(false);
  const [booking, setBooking] = useState(false);
  const { account } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const [family, setFamily] = useState<FamilyPayValue>(null);
  const [slot, setSlot] = useState<PickupSlot | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const d = params.get("d");
    const c = params.get("c") as Category | null;
    const known = c && c in CATEGORY_LABEL;
    // "Book again" passes both the old problem and its category.
    if (known) setCategory(c);
    if (d) setDescription(d);
    else if (known) setDescription(t(catExKey(c)));
  }, [params, t]);
  useEffect(() => {
    api<{ center: { lat: number; lng: number } }>("/api/karigars").then((r) => setCenter(r.center)).catch(() => {});
  }, [account?.id, account?.lat, account?.lng]);

  async function getQuote() {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ quote: Quote & { warning?: string }; offers: Offer[] }>("/api/quote", { photo, description, category: category ?? undefined });
      setQuote(r.quote);
      setOffers(r.offers);
      const wanted = params.get("k");
      setSelected(r.offers.find((o) => o.karigar.id === wanted)?.karigar.id ?? r.offers.find((o) => o.best)?.karigar.id ?? null);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // `afterLogin` is true only when called right after logging in from the sheet.
  async function book(afterLogin?: unknown) {
    if (!quote || !selected) return;
    if (!account && afterLogin !== true) {
      setLoginOpen(true);
      return;
    }
    setBooking(true);
    setError(null);
    try {
      const r = await api<{ order: Order }>("/api/orders", { quoteId: quote.id, karigarId: selected, donation: donate ? 1 : 0, familyPay: family?.name.trim() ? family : undefined, pickupSlot: slot ?? undefined, coupon: coupon?.code });
      router.push(`/orders/${r.order.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBooking(false);
    }
  }

  const offer = offers.find((o) => o.karigar.id === selected);
  // Without the AI key the estimator cannot read photos, so a photo alone needs a category or a description.
  const needsCategory = cfg?.ai.mode === "simulated" && !!photo && !description.trim() && !category;
  const mid = quote ? (quote.repairLow + quote.repairHigh) / 2 : 0;
  const homeVisit = quote?.category === "plumbing" || quote?.category === "electrical";
  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];
  const dayLabel = (d: number) => (d === 0 ? t("sameDay") : `${d} ${d > 1 ? t("days") : t("day")}`);
  // Sudhaar Care members don't pay the pickup / visit fee; a coupon comes off Sudhaar's share.
  const careCovered = account?.care && offer ? offer.pickupFee : 0;
  const couponOff = coupon?.amount ?? 0;
  const payUsd = offer ? Math.round((offer.total + (donate ? 1 : 0) - careCovered - couponOff) * 100) / 100 : 0;

  return (
    <div className="mx-auto max-w-6xl">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="min-w-0 space-y-5">
      {/* stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground ring-1 ring-border")}>{i + 1}</span>
            <span className={cn("hidden text-xs font-medium sm:block", i <= step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-muted")} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{t("describeTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("describeSub")}</p>
            </div>
            <PhotoPicker label={t("snap")} onUploaded={(f) => setPhoto(f)} />
            <div className="flex items-start gap-2">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("askPlaceholder")} className="min-h-24" />
              <MicButton onText={setDescription} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">{t("fixKind")}</p>
              <CategoryChips value={category} onChange={setCategory} />
            </div>
            {needsCategory && <p className="text-xs text-gold">{t("fixNeedCat")}</p>}
            <Button size="lg" className="w-full" onClick={getQuote} disabled={loading || (!photo && !description.trim()) || needsCategory}>
              {loading ? (
                <>
                  <Sparkles className="animate-spin" /> {t("analysing")}
                </>
              ) : (
                <>
                  {t("getQuote")} <ArrowRight />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && quote && (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">{t(catKey(quote.category))}</Badge>
                <h1 className="mt-2 text-2xl font-bold">{quote.item}</h1>
                <p className="text-sm text-muted-foreground">{quote.issue}</p>
              </div>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/uploads/${photo}`} alt="" className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
              )}
            </div>
            {quote.repairable ? (
              <>
                <FixMeter repairMid={mid} newPrice={quote.newPrice} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
                    <p className="text-[11px] text-muted-foreground">{t("repairCost")}</p>
                    <p className="font-display text-lg font-bold text-primary">
                      {rupees(quote.repairLow)}–{rupees(quote.repairHigh)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
                    <p className="text-[11px] text-muted-foreground">{t("newCost")}</p>
                    <p className="font-display text-lg font-bold">{quote.newPrice ? rupees(quote.newPrice) : "–"}</p>
                  </div>
                  <div className="rounded-2xl bg-gold/10 p-3 ring-1 ring-gold/25">
                    <p className="text-[11px] text-muted-foreground">{t("youSave")}</p>
                    <p className="font-display text-lg font-bold text-gold">{quote.newPrice ? `~${rupees(Math.max(0, quote.newPrice - mid))}` : "–"}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="flex gap-2 rounded-2xl bg-gold/10 p-4 text-sm text-gold ring-1 ring-gold/25">
                <Recycle className="size-5 shrink-0" /> {t("notWorth")}
              </p>
            )}
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Badge variant={quote.source === "simulated" ? "gold" : "default"}>{quote.source === "simulated" ? "Simulated" : "Gemini vision"}</Badge>
              {quote.notes}
            </p>
            {quote.warning && <p className="text-xs text-gold">{quote.warning}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft /> {t("back")}
              </Button>
              {!quote.repairable && (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => { setQuote(null); setPhoto(undefined); setDescription(""); setStep(0); }}>
                    {t("fixTryAnother")}
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/agent">{t("fixAskSudhaar")}</Link>
                  </Button>
                </>
              )}
              {quote.repairable && (
                <Button className="flex-1" onClick={() => setStep(2)} disabled={offers.length === 0}>
                  {t("chooseKarigar")} <ArrowRight />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && quote && (
        <Card>
          <CardContent className="space-y-4">
            <h1 className="text-2xl font-bold">{t("chooseKarigar")}</h1>
            <p className="-mt-2 text-sm text-muted-foreground">{t("fixCompareSub")}</p>
            <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">{offers.map((o) => <OfferRow key={o.karigar.id} o={o} selected={selected === o.karigar.id} onSelect={setSelected} dayLabel={dayLabel} />)}</div>
              {center && (
                <NeighbourhoodMap
                  center={center}
                  pins={offers.map((o) => ({ id: o.karigar.id, name: o.karigar.name, lat: o.karigar.lat, lng: o.karigar.lng, color: o.karigar.avatarColor, label: rupees(o.price) }))}
                  selected={selected}
                  onSelect={setSelected}
                  className="min-h-80"
                />
              )}
            </div>
            <Tabs defaultValue="list" className="lg:hidden">
              <TabsList>
                <TabsTrigger value="list">
                  <List className="size-4" /> {t("list")}
                </TabsTrigger>
                <TabsTrigger value="map">
                  <MapIcon className="size-4" /> {t("map")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="space-y-2">
                {offers.map((o) => (
                  <OfferRow key={o.karigar.id} o={o} selected={selected === o.karigar.id} onSelect={setSelected} dayLabel={dayLabel} />
                ))}
              </TabsContent>
              <TabsContent value="map">
                {center && (
                  <NeighbourhoodMap
                    center={center}
                    pins={offers.map((o) => ({ id: o.karigar.id, name: o.karigar.name, lat: o.karigar.lat, lng: o.karigar.lng, color: o.karigar.avatarColor, label: rupees(o.price) }))}
                    selected={selected}
                    onSelect={setSelected}
                    className="aspect-[400/260]"
                  />
                )}
              </TabsContent>
            </Tabs>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft /> {t("back")}
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)} disabled={!selected}>
                {t("next")} <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && quote && offer && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={offer.karigar.name} color={offer.karigar.avatarColor} className="size-14" />
              <div>
                <p className="text-xs text-muted-foreground">{quote.item}</p>
                <h1 className="text-xl font-bold">{offer.karigar.shop}</h1>
                <p className="text-xs text-muted-foreground">
                  {offer.karigar.name} · {offer.distanceKm} km · {dayLabel(offer.readyInDays)}
                </p>
              </div>
            </div>
            <div className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm ring-1 ring-border">
              <Row k={t("repairCost")} v={rupees(offer.price)} />
              <Row k={homeVisit ? t("visitFee") : `${t("pickupFee")} (${offer.distanceKm} km)`} v={rupees(offer.pickupFee)} />
              {careCovered > 0 && <Row k={t("careCovers")} v={`−${rupees(careCovered)}`} tone="text-teal" />}
              {coupon && <Row k={`${t("cpTitle")} ${coupon.code}`} v={`−${rupees(coupon.amount)}`} tone="text-teal" />}
              <label className="flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-[#d9572b]" checked={donate} onChange={(e) => setDonate(e.target.checked)} />
                  {t("toolFund")}
                </span>
                <span>{rupees(donate ? 1 : 0)}</span>
              </label>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>{t("total")}</span>
                <span className="text-right">
                  <span className="block font-display text-lg">{rupeeTotal(offer.price, offer.pickupFee, donate ? 1 : 0, -careCovered, -couponOff)}</span>
                  <UsdNote usd={payUsd} />
                </span>
              </div>
            </div>
            <CouponBox repairCharge={offer.price} pickupFee={offer.pickupFee} value={coupon} onChange={setCoupon} />
            {!account?.care && (
              <Link href="/care" className="block rounded-2xl bg-teal/10 p-3 text-xs text-teal ring-1 ring-teal/25 hover:bg-teal/15">
                <b>{t("careUpsellTitle")}</b> {t("careUpsell", { price: rupees(CARE_PRICE_USD) })}
              </Link>
            )}
            <SlotPicker value={slot} onChange={setSlot} visit={homeVisit} />
            <FamilyPayPicker value={family} onChange={setFamily} />
            <p className="rounded-2xl bg-[#0070e0]/10 p-3 text-xs text-paypal-blue ring-1 ring-[#0070e0]/30">{t("trustPaypal")}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft /> {t("back")}
              </Button>
              <Button size="lg" className="flex-1" onClick={book} disabled={booking || (family !== null && !family.name.trim())}>
                {booking ? t("creating") : t("bookPay")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <LoginSheet open={loginOpen} onOpenChange={setLoginOpen} onDone={() => book(true)} />
    </div>
    <Summary step={step} photo={photo} description={description} quote={quote} offer={offer} payUsd={payUsd} />
    </div>
    </div>
  );
}

/** Desktop sidebar: what you've chosen so far, and how Sudhaar protects the booking. */
function Summary({ step, photo, description, quote, offer, payUsd }: { step: number; photo?: string; description: string; quote: Quote | null; offer?: Offer; payUsd: number }) {
  const { t } = useLang();
  const guards: [typeof Wallet, string][] = [
    [Wallet, t("fixGuardHold")],
    [KeyRound, t("fixGuardOtp")],
    [Camera, t("fixGuardPhoto")],
    [ShieldCheck, t("fixGuardWarranty")],
    [Truck, t("fixGuardTrack")],
  ];
  return (
    <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("fixYourRepair")}</p>
          <div className="flex items-start gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/uploads/${photo}`} alt="" className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-border" />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                <Camera className="size-6" />
              </span>
            )}
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{quote?.item ?? t("fixNothingYet")}</p>
              <p className="line-clamp-3 text-xs text-muted-foreground">{quote?.issue ?? (description || t("fixDescribeHint"))}</p>
            </div>
          </div>
          {quote?.repairable && (
            <div className="flex justify-between rounded-xl bg-primary/10 p-2.5 text-sm ring-1 ring-primary/20">
              <span className="text-muted-foreground">{t("repairCost")}</span>
              <b className="text-primary">
                {rupees(quote.repairLow)}–{rupees(quote.repairHigh)}
              </b>
            </div>
          )}
          {offer && step >= 2 && (
            <div className="space-y-1 rounded-xl bg-muted/50 p-2.5 text-sm ring-1 ring-border">
              <p className="flex items-center gap-2 font-semibold">
                <Avatar name={offer.karigar.name} color={offer.karigar.avatarColor} className="size-7 text-[11px]" /> {offer.karigar.shop}
              </p>
              <p className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {offer.distanceKm} km · ★ {offer.karigar.rating.toFixed(1)}
                </span>
                {step === 3 && <b className="text-foreground">{rupees(payUsd)}</b>}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("fixProtected")}</p>
          {guards.map(([Icon, text]) => (
            <p key={text} className="flex items-start gap-2 text-xs">
              <Icon className="mt-0.5 size-4 shrink-0 text-teal" /> {text}
            </p>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}

function OfferRow({ o, selected, onSelect, dayLabel }: { o: Offer; selected: boolean; onSelect: (id: string) => void; dayLabel: (d: number) => string }) {
  const { t } = useLang();
  return (
    <button onClick={() => onSelect(o.karigar.id)} className={cn("w-full rounded-2xl p-3 text-left ring-1 transition", selected ? "bg-primary/10 ring-primary" : "bg-muted/50 ring-border hover:bg-muted")}>
      <div className="flex items-center gap-3">
        <Avatar name={o.karigar.name} color={o.karigar.avatarColor} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            {o.karigar.shop} {o.karigar.onboarded && <BadgeCheck className="size-4 text-primary" />}
            {!o.karigar.onboarded && <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">{t("sampleProfile")}</span>}
            {o.best && <Badge variant="gold">{t("bestValue")}</Badge>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-gold">
              <Star className="size-3 fill-gold" /> {o.karigar.ratingCount ? o.karigar.rating.toFixed(1) : t("newKarigar")}
            </span>
            <span>{o.distanceKm} km</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {dayLabel(o.readyInDays)}
            </span>
            <span>{o.karigar.languages.join(", ")}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold">{rupees(o.price)}</p>
          <p className="text-[11px] text-muted-foreground">+{rupees(o.pickupFee)}</p>
        </div>
      </div>
    </button>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className={cn("flex justify-between", tone)}>
      <span className={tone ? undefined : "text-muted-foreground"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
