"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bike, Leaf, PiggyBank, Plus, Trash2 } from "lucide-react";
import { api, money } from "@/components/api";
import { Chappal, Diya, Mixer, NeedleThread } from "@/components/Doodles";
import { FamilyPayPicker, type FamilyPayValue } from "@/components/FamilyPay";
import { useLang } from "@/components/LanguageProvider";
import { MicButton } from "@/components/MicButton";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { AVG_ITEM_KG, basketPickupFee, HOME_VISIT_CATEGORIES } from "@/lib/pricing";
import type { Karigar, Order, Quote } from "@/lib/types";

type Offer = { karigar: Karigar; distanceKm: number; price: number; pickupFee: number; readyInDays: number; best?: boolean };
type Line = { quote: Quote; offers: Offer[]; karigarId: string };

export default function GharSafai() {
  const router = useRouter();
  const { t } = useLang();
  const [photo, setPhoto] = useState<string>();
  const [photoKey, setPhotoKey] = useState(0);
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [donate, setDonate] = useState(true);
  const [family, setFamily] = useState<FamilyPayValue>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    setAdding(true);
    try {
      const r = await api<{ quote: Quote; offers: Offer[] }>("/api/quote", { photo, description });
      if (HOME_VISIT_CATEGORIES.includes(r.quote.category)) throw new Error(`"${r.quote.item}" needs a home visit, so book it from the Home tab.`);
      if (!r.quote.repairable) throw new Error(`"${r.quote.item}" doesn't look worth repairing. We'll suggest recycling it instead.`);
      if (r.offers.length === 0) throw new Error(`No karigar nearby for "${r.quote.item}" yet.`);
      setLines((l) => [...l, { quote: r.quote, offers: r.offers, karigarId: (r.offers.find((o) => o.best) ?? r.offers[0]).karigar.id }]);
      setDescription("");
      setPhoto(undefined);
      setPhotoKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  const chosen = lines.map((l) => ({ line: l, offer: l.offers.find((o) => o.karigar.id === l.karigarId)! }));
  const stops = new Set(lines.map((l) => l.karigarId)).size;
  const fees = chosen.map((c) => c.offer.pickupFee);
  const oneTrip = basketPickupFee(fees, stops);
  const separate = fees.reduce((a, b) => a + b, 0);
  const repairSum = chosen.reduce((s, c) => s + c.offer.price, 0);
  const savedVsNew = chosen.reduce((s, c) => s + Math.max(0, c.line.quote.newPrice - c.offer.price), 0);
  const kg = chosen.reduce((s, c) => s + AVG_ITEM_KG[c.line.quote.category], 0);
  const total = repairSum + oneTrip + (donate ? 1 : 0);

  async function book() {
    setBooking(true);
    setError(null);
    try {
      const r = await api<{ order: Order }>("/api/baskets", {
        items: lines.map((l) => ({ quoteId: l.quote.id, karigarId: l.karigarId })),
        donation: donate ? 1 : 0,
        familyPay: family?.name.trim() ? family : undefined,
      });
      router.push(`/orders/${r.order.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBooking(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffe1b8] via-[#fff1dc] to-[#ffd6c2] p-5 ring-1 ring-border md:p-7">
        <Diya className="absolute -right-2 -top-1 w-28 md:right-6 md:top-4 md:w-36" />
        <Badge variant="gold">🪔 {t("gharKicker")}</Badge>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{t("gharTitle")}</h1>
        <p className="mt-1 max-w-xl pr-24 text-sm text-muted-foreground md:pr-0 md:text-base">{t("gharSub")}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Card className="h-fit">
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Plus className="size-5 text-primary" /> {t("gharAddTitle")}
            </h2>
            <PhotoPicker key={photoKey} label={t("snap")} onUploaded={(f) => setPhoto(f)} />
            <div className="flex items-start gap-2">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("askPlaceholder")} />
              <MicButton onText={setDescription} />
            </div>
            <Button className="w-full" size="lg" onClick={add} disabled={adding || (!photo && !description.trim())}>
              {adding ? t("gharAdding") : t("gharAdd")}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{t("gharBasket")}</h2>
              <span className="text-xs text-muted-foreground">
                {lines.length} {t("gharItems")} · {stops} {t("gharKarigars")}
              </span>
            </div>

            {lines.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted/50 p-6 text-center">
                <div className="flex items-end gap-3">
                  <Chappal className="w-16" />
                  <Mixer className="w-12" />
                  <NeedleThread className="w-20" />
                </div>
                <p className="text-sm text-muted-foreground">{t("gharEmpty")}</p>
              </div>
            )}

            <ul className="space-y-2">
              {chosen.map(({ line, offer }, i) => (
                <li key={line.quote.id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2.5 ring-1 ring-border">
                  {line.quote.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${line.quote.photo}`} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <Avatar name={offer.karigar.name} color={offer.karigar.avatarColor} className="size-12" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{line.quote.item}</p>
                    <select
                      value={line.karigarId}
                      onChange={(e) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, karigarId: e.target.value } : l)))}
                      className="mt-0.5 w-full truncate rounded-lg border border-input bg-card px-2 py-1 text-xs"
                      aria-label="Karigar"
                    >
                      {line.offers.map((o) => (
                        <option key={o.karigar.id} value={o.karigar.id}>
                          {o.karigar.shop} · {money(o.price)} · {o.distanceKm} km{o.best ? " · best" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="font-display text-lg font-bold">{money(offer.price)}</p>
                  <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            {lines.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-teal/10 p-2.5">
                    <Bike className="mx-auto size-4 text-teal" />
                    <p className="font-display text-lg font-bold">{money(Math.max(0, separate - oneTrip))}</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{t("gharTripSaving")}</p>
                  </div>
                  <div className="rounded-2xl bg-marigold/15 p-2.5">
                    <PiggyBank className="mx-auto size-4 text-gold" />
                    <p className="font-display text-lg font-bold">{money(savedVsNew)}</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{t("impactSaved")}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-2.5">
                    <Leaf className="mx-auto size-4 text-primary" />
                    <p className="font-display text-lg font-bold">{kg.toFixed(1)} kg</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{t("impactKg")}</p>
                  </div>
                </div>
                <div className="space-y-1.5 rounded-2xl p-3 text-sm ring-1 ring-border">
                  <Row k={`${t("repairCost")} (${lines.length} ${t("gharItems")})`} v={money(repairSum)} />
                  <Row k={t("gharOneTrip")} v={money(oneTrip)} strike={separate > oneTrip ? money(separate) : undefined} />
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" className="size-4 accent-[#d9572b]" checked={donate} onChange={(e) => setDonate(e.target.checked)} /> {t("toolFund")}
                    </span>
                    <span>{money(donate ? 1 : 0)}</span>
                  </label>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <span>{t("total")}</span>
                    <span className="font-display text-lg">{money(total)}</span>
                  </div>
                </div>
                <FamilyPayPicker value={family} onChange={setFamily} />
                <Button size="lg" className="w-full" onClick={book} disabled={booking || (family !== null && !family.name.trim())}>
                  {booking ? t("creating") : `${t("gharReview")} · ${money(total)}`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v, strike }: { k: string; v: string; strike?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span>
        {strike && <span className="mr-1.5 text-xs text-muted-foreground line-through">{strike}</span>}
        {v}
      </span>
    </div>
  );
}
