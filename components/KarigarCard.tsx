"use client";

import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useLang } from "./LanguageProvider";
import type { Karigar } from "@/lib/types";

export function KarigarCard({ k, distanceKm }: { k: Karigar; distanceKm?: number }) {
  const { t } = useLang();
  return (
    <Link href={`/karigars/${k.id}`} className="paper group flex w-64 shrink-0 flex-col gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5 hover:bg-muted">
      <div className="flex items-center gap-3">
        <Avatar name={k.name} color={k.avatarColor} />
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-semibold">
            {k.shop} <BadgeCheck className="size-4 shrink-0 text-primary" />
          </p>
          <p className="truncate text-xs text-muted-foreground">{k.craft}</p>
        </div>
      </div>
      <p className="line-clamp-2 text-xs italic text-muted-foreground">&ldquo;{k.bio}&rdquo;</p>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 font-semibold text-gold">
          <Star className="size-3.5 fill-gold" /> {k.jobsDone > 0 ? k.rating.toFixed(1) : t("newKarigar")}
        </span>
        <span className="text-muted-foreground">{t("kpYears", { n: k.yearsExperience })}</span>
        {distanceKm !== undefined && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-3.5" /> {distanceKm.toFixed(1)} km
          </span>
        )}
      </div>
    </Link>
  );
}
