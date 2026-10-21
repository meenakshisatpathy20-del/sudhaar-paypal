"use client";

import { rupees } from "@/components/Inr";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Briefcase, Languages, MapPin, Quote, Star } from "lucide-react";
import { api } from "@/components/api";
import { NeighbourhoodMap } from "@/components/NeighbourhoodMap";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/components/LanguageProvider";
import { CATEGORY_I18N } from "@/lib/i18n";
import { CATEGORY_LABEL } from "@/lib/pricing";
import type { Karigar } from "@/lib/types";

export default function KarigarProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [k, setK] = useState<(Karigar & { distanceKm: number }) | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { t, lang } = useLang();

  useEffect(() => {
    api<{ karigar: Karigar & { distanceKm: number }; completedOnSudhaar: number }>(`/api/karigars/${id}`)
      .then((r) => {
        setK(r.karigar);
        setDone(r.completedOnSudhaar);
      })
      .catch((e) => setError(e.message));
    api<{ center: { lat: number; lng: number } }>("/api/karigars").then((r) => setCenter(r.center)).catch(() => {});
  }, [id]);

  if (error) return <Card className="p-6 text-destructive">{error}</Card>;
  if (!k) return <Card className="h-64 animate-pulse" />;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24" style={{ background: `linear-gradient(135deg, ${k.avatarColor}55, transparent)` }} />
          <CardContent className="relative space-y-4 pt-8">
            <div className="flex items-end gap-4">
              <Avatar name={k.name} color={k.avatarColor} className="size-20 rounded-3xl text-2xl" />
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                  {k.shop} <BadgeCheck className="size-5 text-primary" />
                </h1>
                <p className="text-sm text-muted-foreground">
                  {k.name} · {k.craft}
                </p>
              </div>
            </div>
            {!k.onboarded && (
              <p className="rounded-xl bg-marigold/15 px-3 py-2 text-xs text-[#7a4a06]">
                <b>{t("sampleProfile")}:</b> {t("sampleNote")}
              </p>
            )}
            <p className="flex gap-2 rounded-2xl bg-muted/60 p-4 font-display text-lg leading-snug ring-1 ring-border">
              <Quote className="size-5 shrink-0 text-gold" /> {k.bio}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact icon={Star} v={k.jobsDone > 0 ? `${k.rating.toFixed(1)}★` : t("newKarigar")} l={t("kpJobs", { n: k.jobsDone })} />
              <Fact icon={Briefcase} v={t("kpYears", { n: k.yearsExperience })} l={t("kpExperience")} />
              <Fact icon={MapPin} v={`${k.distanceKm.toFixed(1)} km`} l={k.area} />
              <Fact icon={Languages} v={String(k.languages.length)} l={k.languages.join(", ")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge>
                <BadgeCheck /> {t("kpKyc")}
              </Badge>
              {k.skills.map((s) => (
                <Badge key={s} variant="outline">
                  {CATEGORY_I18N[s]?.[lang] ?? CATEGORY_LABEL[s]}
                </Badge>
              ))}
              {done > 0 && <Badge variant="gold">{t("kpOnSudhaar", { n: done })}</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-bold">
              {t("kpReviews")} {!k.onboarded && k.reviews.length > 0 && <span className="text-xs font-normal text-muted-foreground">({t("sampleProfile")})</span>}
            </h2>
            {k.reviews.length === 0 && <p className="text-sm text-muted-foreground">{t("kpNoReviews")}</p>}
            {k.reviews.map((r) => (
              <div key={r.name} className="rounded-2xl bg-muted/50 p-3 ring-1 ring-border">
                <p className="flex items-center justify-between text-sm font-semibold">
                  {r.name}
                  <span className="flex items-center gap-1 text-xs text-gold">
                    <Star className="size-3 fill-gold" /> {r.rating}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-bold">{t("kpPrices")}</h2>
            {k.services.length === 0 && <p className="text-sm text-muted-foreground">{t("kpNoPrices")}</p>}
            {k.services.map((s) => (
              <p key={s.name} className="flex justify-between border-b border-border pb-2 text-sm last:border-0">
                <span>{s.name}</span>
                <span className="font-semibold">{rupees(s.price)}</span>
              </p>
            ))}
            <p className="text-xs text-muted-foreground">{t("kpFinal")}</p>
            <Button asChild size="lg" className="w-full">
              <Link href={`/fix?k=${k.id}`}>
                {t("kpQuote", { name: k.name.split(" ")[0] })} <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
        {center && <NeighbourhoodMap center={center} pins={[{ id: k.id, name: k.name, lat: k.lat, lng: k.lng, color: k.avatarColor, label: k.area }]} selected={k.id} className="aspect-[400/260]" />}
      </div>
    </div>
  );
}

function Fact({ icon: Icon, v, l }: { icon: React.ComponentType<{ className?: string }>; v: string; l: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
      <Icon className="size-4 text-primary" />
      <p className="mt-1 font-display text-lg font-bold">{v}</p>
      <p className="truncate text-[11px] text-muted-foreground">{l}</p>
    </div>
  );
}
