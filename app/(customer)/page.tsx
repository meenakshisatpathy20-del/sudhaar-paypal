"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Camera, Handshake, Leaf, PiggyBank, ShieldCheck, Sparkles, Truck, Wallet, Wrench } from "lucide-react";
import { api, money } from "@/components/api";
import { CATEGORY_ICON } from "@/components/CategoryIcon";
import { KarigarCard } from "@/components/KarigarCard";
import { useLang } from "@/components/LanguageProvider";
import { MicButton } from "@/components/MicButton";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CATEGORY_I18N } from "@/lib/i18n";
import type { Category, Karigar } from "@/lib/types";

const HeroScene = dynamic(() => import("@/components/HeroScene"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-full bg-primary/5" />,
});

type KarigarWithDistance = Karigar & { distanceKm: number };
type Impact = { itemsRepaired: number; kgSaved: number; moneySaved: number; karigarEarnings: number };

const CATS: Category[] = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"];

export default function Home() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [text, setText] = useState("");
  const [karigars, setKarigars] = useState<KarigarWithDistance[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);

  useEffect(() => {
    api<{ karigars: KarigarWithDistance[]; center: { lat: number; lng: number } }>("/api/karigars")
      .then((r) => {
        setKarigars(r.karigars);
        setCenter(r.center);
      })
      .catch(() => {});
    api<{ impact: Impact }>("/api/admin")
      .then((r) => setImpact(r.impact))
      .catch(() => {});
  }, []);

  const go = (q: string) => router.push(q.trim() ? `/fix?d=${encodeURIComponent(q.trim())}` : "/fix");
  const sel = karigars.find((k) => k.id === selected);

  return (
    <div className="space-y-14">
      {/* HERO */}
      <section className="relative grid items-center gap-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0b1a18] via-[#081211] to-[#120f06] p-6 md:grid-cols-[1.1fr_1fr] md:p-10">
        <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative z-10 min-w-0 space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-gold ring-1 ring-gold/30">
            <Sparkles className="size-3.5" /> {t("heroKicker")}
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] md:text-6xl">
            {t("heroTitle1")}
            <br />
            <span className="bg-gradient-to-r from-primary via-teal-200 to-gold bg-clip-text text-transparent text-glow">{t("heroTitle2")}</span>
          </h1>
          <p className="max-w-lg text-base text-muted-foreground md:text-lg">{t("heroSub")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(text);
            }}
            className="glass flex items-center gap-2 rounded-2xl p-2 pl-4"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("askPlaceholder")} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <Link href="/fix" aria-label={t("snap")} className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-foreground ring-1 ring-white/10 hover:bg-white/10">
              <Camera className="size-5" />
            </Link>
            <MicButton onText={setText} onFinal={(v) => go(v)} />
          </form>
          <Button size="lg" onClick={() => go(text)} className="w-full sm:w-auto">
            {t("getQuote")} <ArrowRight />
          </Button>
        </div>
        <div className="relative h-72 md:h-[440px]">
          <HeroScene />
        </div>
      </section>

      {/* TRUST */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, text: t("trustPaypal") },
          { icon: BadgeCheck, text: t("trustKyc") },
          { icon: Wrench, text: t("trustWarranty") },
        ].map((x) => (
          <div key={x.text} className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <x.icon className="size-5 shrink-0 text-primary" /> {x.text}
          </div>
        ))}
      </section>

      {/* CATEGORIES */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t("categories")}</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {CATS.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <Link key={c} href={`/fix?c=${c}`} className="glass group flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center transition hover:-translate-y-1 hover:bg-primary/10">
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-gold/10 ring-1 ring-white/10 transition group-hover:scale-110">
                  <Icon className="size-6 text-primary" />
                </span>
                <span className="text-xs font-medium">{CATEGORY_I18N[c][lang]}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* KARIGARS */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("nearYou")}</h2>
          <span className="text-xs text-muted-foreground">{karigars.length} verified</span>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {karigars.map((k) => (
            <KarigarCard key={k.id} k={k} distanceKm={k.distanceKm} />
          ))}
        </div>
      </section>

      {/* MAP + TALK */}
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-3">
            <div>
              <h2 className="text-xl font-bold">{t("mapTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("mapSub")}</p>
            </div>
            {center && (
              <NeighbourhoodMap
                center={center}
                pins={karigars.map((k) => ({ id: k.id, name: k.name, lat: k.lat, lng: k.lng, color: k.avatarColor }))}
                selected={selected}
                onSelect={setSelected}
                className="aspect-[400/260]"
              />
            )}
            {sel && (
              <Link href={`/karigars/${sel.id}`} className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3 py-2 text-sm">
                <span>
                  <b>{sel.shop}</b> · {sel.craft} · {sel.distanceKm.toFixed(1)} km
                </span>
                <ArrowRight className="size-4 text-primary" />
              </Link>
            )}
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary/15 to-transparent">
          <CardContent className="flex h-full flex-col justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{t("talkTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("talkSub")}</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/agent" className="relative grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_60px_-10px] shadow-primary">
                <span className="absolute inset-0 rounded-full bg-primary/40" style={{ animation: "ping-soft 2.4s ease-out infinite" }} />
                <Sparkles className="relative size-8" />
              </Link>
              <p className="text-sm italic text-muted-foreground">“{lang === "hi" ? "मेरा मिक्सर ठीक करवा दो, 8 डॉलर के अंदर" : "Get my mixer fixed under $8 by Friday"}”</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* HOW */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t("howTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { icon: Camera, title: t("how1"), d: t("how1d") },
            { icon: Wallet, title: t("how2"), d: t("how2d") },
            { icon: Truck, title: t("how3"), d: t("how3d") },
            { icon: Handshake, title: t("how4"), d: t("how4d") },
          ].map((s, i) => (
            <Card key={s.title}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-display text-3xl font-bold text-white/10">0{i + 1}</span>
                </div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* IMPACT */}
      {impact && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">{t("impactTitle")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { icon: Wrench, v: String(impact.itemsRepaired), l: t("impactItems") },
              { icon: Leaf, v: `${impact.kgSaved}`, l: t("impactKg") },
              { icon: PiggyBank, v: money(impact.moneySaved), l: t("impactSaved") },
              { icon: Handshake, v: money(impact.karigarEarnings), l: t("impactKarigar") },
            ].map((x) => (
              <Card key={x.l}>
                <CardContent className="space-y-1">
                  <x.icon className="size-5 text-gold" />
                  <p className="font-display text-3xl font-bold">{x.v}</p>
                  <p className="text-xs text-muted-foreground">{x.l}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* STORY */}
      <section className="glass relative overflow-hidden rounded-[2rem] p-6 md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold/10 blur-3xl" />
        <p className="text-sm font-semibold text-gold">{t("storyTitle")}</p>
        <p className="mt-3 max-w-3xl font-display text-xl leading-relaxed md:text-2xl">“{t("story")}”</p>
        <p className="mt-4 text-sm text-muted-foreground">{t("storyBy")}</p>
      </section>

      {/* FOOTER */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-muted-foreground md:flex-row">
        <p>Sudhaar · Repair, don&apos;t replace · Runs on the PayPal sandbox, so no real money moves.</p>
        <Link href="/partner" className="flex items-center gap-1 font-semibold text-primary">
          {t("partners")} <ArrowRight className="size-3.5" />
        </Link>
      </footer>
    </div>
  );
}
