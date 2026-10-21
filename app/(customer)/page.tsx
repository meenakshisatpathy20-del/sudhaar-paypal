"use client";

import { rupees } from "@/components/Inr";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Bike, Camera, HeartHandshake, Leaf, PiggyBank, ShieldCheck, Sparkles, Wrench as WrenchIcon } from "lucide-react";
import { api } from "@/components/api";
import { CATEGORY_ICON } from "@/components/CategoryIcon";
import { Chappal, Diya, HomeHeart, Mixer, NeedleThread, SaathiCycle, Sparkle, Squiggle, Wrench } from "@/components/Doodles";
import { KarigarCard } from "@/components/KarigarCard";
import { useLang } from "@/components/LanguageProvider";
import { MicButton } from "@/components/MicButton";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { catKey } from "@/lib/i18n";
import type { Category, Karigar } from "@/lib/types";

const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false, loading: () => null });

type KarigarWithDistance = Karigar & { distanceKm: number };
type Impact = { itemsRepaired: number; kgSaved: number; moneySaved: number; karigarEarnings: number };

const CATS: Category[] = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"];

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-2xl font-bold leading-none">{children}</h2>
        <Squiggle className="mt-1 h-2.5 w-24" />
      </div>
      {right}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useLang();
  const [text, setText] = useState("");
  const [karigars, setKarigars] = useState<KarigarWithDistance[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const { account } = useSession();

  // Refetch when the customer logs in or shares a new location: distances and the map follow them.
  useEffect(() => {
    api<{ karigars: KarigarWithDistance[]; center: { lat: number; lng: number } }>("/api/karigars")
      .then((r) => {
        setKarigars(r.karigars);
        setCenter(r.center);
      })
      .catch(() => {});
    api<{ impact: Impact }>("/api/impact")
      .then((r) => setImpact(r.impact))
      .catch(() => {});
  }, [account?.id, account?.lat, account?.lng]);

  const go = (q: string) => router.push(q.trim() ? `/fix?d=${encodeURIComponent(q.trim())}` : "/fix");
  const sel = karigars.find((k) => k.id === selected);

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="relative grid items-center gap-2 overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffe9cf] via-[#fff6ea] to-[#e3f3ee] p-5 ring-1 ring-border md:grid-cols-[1.1fr_1fr] md:p-8">
        <Sparkle className="absolute left-[46%] top-6 hidden w-6 md:block" />
        <Sparkle className="absolute bottom-8 left-6 w-4" color="#1f8a7a" />
        <div className="relative z-10 min-w-0 space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary ring-1 ring-border">
            <Sparkles className="size-3.5" /> {t("heroKicker")}
          </p>
          <h1 className="text-4xl font-bold leading-[1.02] md:text-6xl">
            {t("heroTitle1")}
            <br />
            <span className="bg-gradient-to-r from-primary via-[#e9862f] to-teal bg-clip-text text-transparent">{t("heroTitle2")}</span>
          </h1>
          <p className="max-w-lg text-base text-muted-foreground">{t("heroSub")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(text);
            }}
            className="flex items-center gap-2 rounded-2xl bg-card p-1.5 pl-4 shadow-sm ring-1 ring-border"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("askPlaceholder")} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <Link href="/fix" aria-label={t("snap")} className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground hover:bg-secondary">
              <Camera className="size-5" />
            </Link>
            <MicButton onText={setText} onFinal={(v) => go(v)} />
          </form>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => go(text)}>
              {t("getQuote")} <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/ghar-safai">🪔 {t("gharTitle")}</Link>
            </Button>
          </div>
        </div>
        <div className="relative h-64 md:h-[380px]">
          <HeroScene />
          <NeedleThread className="pointer-events-none absolute bottom-2 left-0 w-28 md:w-36" />
          <Chappal className="pointer-events-none absolute right-0 top-0 w-16 md:w-20" />
        </div>
      </section>

      {/* TRUST */}
      <section className="grid gap-2 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, text: t("trustPaypal"), c: "text-[#0050b3]" },
          { icon: BadgeCheck, text: t("trustKyc"), c: "text-teal" },
          { icon: WrenchIcon, text: t("trustWarranty"), c: "text-primary" },
        ].map((x) => (
          <div key={x.text} className="paper flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium">
            <x.icon className={`size-5 shrink-0 ${x.c}`} /> {x.text}
          </div>
        ))}
      </section>

      {/* GHAR SAFAI */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffd9a8] via-[#ffecd1] to-[#ffd0bd] p-5 ring-1 ring-border md:p-6">
        <div className="relative z-10 grid items-center gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">{t("gharKicker")}</p>
            <h2 className="text-3xl font-bold">{t("gharTitle")}</h2>
            <p className="max-w-2xl text-sm text-[#5a4434]">{t("gharSub")}</p>
            <Button asChild size="lg" className="mt-1">
              <Link href="/ghar-safai">
                {t("gharCta")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="flex items-end justify-center gap-2">
            <Mixer className="w-14" />
            <Diya className="w-28" />
            <Chappal className="w-16" />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section>
        <SectionTitle>{t("categories")}</SectionTitle>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {CATS.map((c, i) => {
            const Icon = CATEGORY_ICON[c];
            const tint = ["bg-[#ffe3cc]", "bg-[#d8efe9]", "bg-[#fde8b8]", "bg-[#f9d8d0]"][i % 4];
            return (
              <Link key={c} href={`/fix?c=${c}`} className="paper group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center transition hover:-translate-y-0.5">
                <span className={`grid size-12 place-items-center rounded-2xl ${tint} transition group-hover:scale-110 group-hover:rotate-3`}>
                  <Icon className="size-6 text-foreground" strokeWidth={1.8} />
                </span>
                <span className="text-xs font-semibold leading-tight">{t(catKey(c))}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* KARIGARS */}
      <section>
        <SectionTitle right={<span className="text-xs text-muted-foreground">{karigars.length} verified</span>}>{t("nearYou")}</SectionTitle>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {karigars.map((k) => (
            <KarigarCard key={k.id} k={k} distanceKm={k.distanceKm} />
          ))}
        </div>
      </section>

      {/* MAP + FAMILY PAY + TALK */}
      <section className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardContent className="space-y-2">
            <div>
              <h2 className="text-xl font-bold">{t("mapTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("mapSub")}</p>
            </div>
            {center && (
              <NeighbourhoodMap
                center={center}
                pins={karigars.map((k) => ({ id: k.id, name: k.name, lat: k.lat, lng: k.lng, color: k.avatarColor }))}
                selected={selected}
                onSelect={setSelected}
                className="aspect-[400/250]"
              />
            )}
            {sel && (
              <Link href={`/karigars/${sel.id}`} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                <span>
                  <b>{sel.shop}</b> · {sel.craft} · {sel.distanceKm.toFixed(1)} km
                </span>
                <ArrowRight className="size-4 text-primary" />
              </Link>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-3">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#d8efe9] to-card">
            <CardContent className="flex h-full flex-col justify-center gap-3">
              <div className="flex items-center gap-3">
                <HomeHeart className="w-16 shrink-0" />
                <div>
                  <p className="flex items-center gap-1.5 font-display text-lg font-bold">
                    <HeartHandshake className="size-5 text-teal" /> {t("homeFamilyPay")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("familyPaySub")}</p>
                </div>
              </div>
              <ol className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-medium">
                {[t("homeFp1"), t("homeFp2"), t("homeFp3")].map((s, i) => (
                  <li key={s} className="rounded-xl bg-card/80 px-1.5 py-2 ring-1 ring-border">
                    <span className="mx-auto mb-1 grid size-5 place-items-center rounded-full bg-teal text-[10px] font-bold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Link href="/agent" className="paper flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#ffe3cc] to-card p-4 transition hover:-translate-y-0.5">
            <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <span className="absolute inset-0 rounded-full bg-primary/40" style={{ animation: "ping-soft 2.4s ease-out infinite" }} />
              <Sparkles className="relative size-6" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="font-display text-lg font-bold">{t("talkTitle")}</p>
              <p className="text-xs italic text-muted-foreground">“{t("homeTalkEx")}”</p>
              <p className="flex flex-wrap gap-1 text-[10px] font-semibold">
                <span className="rounded-full bg-card px-2 py-0.5 ring-1 ring-border">🎤 {t("homeVoice")}</span>
                <span className="rounded-full bg-card px-2 py-0.5 ring-1 ring-border">🔊 {t("homeSpeaks")}</span>
                <span className="rounded-full bg-card px-2 py-0.5 ring-1 ring-border">💳 {t("homeBooks")}</span>
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* HOW */}
      <section>
        <SectionTitle>{t("howTitle")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { art: <Mixer className="h-16" />, title: t("how1"), d: t("how1d") },
            { art: <HomeHeart className="h-16" />, title: t("how2"), d: t("how2d") },
            { art: <SaathiCycle className="h-16" />, title: t("how3"), d: t("how3d") },
            { art: <Wrench className="h-16" />, title: t("how4"), d: t("how4d") },
          ].map((s, i) => (
            <Card key={s.title}>
              <CardContent className="space-y-1.5">
                <div className="flex items-start justify-between">
                  {s.art}
                  <span className="font-display text-2xl font-bold text-primary/25">0{i + 1}</span>
                </div>
                <p className="font-semibold leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* IMPACT */}
      {impact && (
        <section>
          <SectionTitle>{t("impactTitle")}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { icon: WrenchIcon, v: String(impact.itemsRepaired), l: t("impactItems"), c: "text-primary" },
              { icon: Leaf, v: `${impact.kgSaved}`, l: t("impactKg"), c: "text-teal" },
              { icon: PiggyBank, v: rupees(impact.moneySaved), l: t("impactSaved"), c: "text-gold" },
              { icon: HeartHandshake, v: rupees(impact.karigarEarnings), l: t("impactKarigar"), c: "text-primary" },
            ].map((x) => (
              <Card key={x.l}>
                <CardContent className="space-y-0.5">
                  <x.icon className={`size-5 ${x.c}`} />
                  <p className="font-display text-3xl font-bold leading-tight">{x.v}</p>
                  <p className="text-xs text-muted-foreground">{x.l}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* STORY */}
      <section className="paper relative overflow-hidden rounded-3xl p-5 md:p-8">
        <Diya className="absolute -bottom-2 right-2 w-24 opacity-90 md:w-32" />
        <p className="text-sm font-bold text-primary">{t("storyTitle")}</p>
        <p className="mt-2 max-w-3xl pr-16 font-display text-xl leading-snug md:text-2xl">“{t("story")}”</p>
        <p className="mt-3 text-sm text-muted-foreground">{t("storyBy")}</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/join" className="flex items-center justify-between gap-3 rounded-2xl bg-teal/10 p-4 text-sm font-semibold text-teal ring-1 ring-teal/25 transition hover:bg-teal/15">
          <span className="flex items-center gap-2">
            <WrenchIcon className="size-4 shrink-0" /> {t("joinCta")}
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
        <Link href="/join?as=saathi" className="flex items-center justify-between gap-3 rounded-2xl bg-marigold/15 p-4 text-sm font-semibold text-[#7a4a06] ring-1 ring-marigold/30 transition hover:bg-marigold/20">
          <span className="flex items-center gap-2">
            <Bike className="size-4 shrink-0" /> {t("saCta")}
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      </div>

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground md:flex-row">
        <p>{t("footerLine")}</p>
        <p>{t("footerCare")}</p>
      </footer>
    </div>
  );
}
