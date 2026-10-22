"use client";

import { Clock } from "lucide-react";
import { langMeta } from "@/lib/i18n";
import { slotLabel } from "@/lib/slots";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { useLang } from "./LanguageProvider";

/** "Pickup: Today, 5–7 pm" (or "Visit: …" for plumbers and electricians), in Indian time. */
export function SlotLine({ order, className }: { order: Order; className?: string }) {
  const { t, lang } = useLang();
  if (!order.pickupSlot) return null;
  const when = slotLabel(order.pickupSlot, langMeta(lang).locale, { today: t("slotToday"), tomorrow: t("slotTomorrow") });
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-medium", className)}>
      <Clock className="size-4 shrink-0 text-primary" />
      {t(order.mode === "pickup" ? "slotPickup" : "slotVisit", { when })}
    </p>
  );
}
