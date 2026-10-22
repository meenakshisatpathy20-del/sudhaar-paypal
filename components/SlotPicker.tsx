"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { langMeta } from "@/lib/i18n";
import { pickupSlots, slotLabel } from "@/lib/slots";
import { cn } from "@/lib/utils";
import type { PickupSlot } from "@/lib/types";
import { useLang } from "./LanguageProvider";

/** Lets the customer choose when the Saathi comes (or the plumber/electrician visits). Picks the earliest by default. */
export function SlotPicker({ value, onChange, visit }: { value: PickupSlot | null; onChange: (s: PickupSlot) => void; visit?: boolean }) {
  const { t, lang } = useLang();
  // Worked out in the browser after load, so server and browser never disagree about "now".
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  useEffect(() => {
    const s = pickupSlots();
    setSlots(s);
    if (!value && s[0]) onChange(s[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!slots.length) return null;
  const words = { today: t("slotToday"), tomorrow: t("slotTomorrow") };
  return (
    <div className="space-y-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-border">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Clock className="size-4 text-primary" /> {visit ? t("slotTitleVisit") : t("slotTitle")}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {slots.map((s) => (
          <button
            key={s.start}
            type="button"
            role="radio"
            aria-checked={value?.start === s.start}
            onClick={() => onChange(s)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ring-1", value?.start === s.start ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:bg-muted")}
          >
            {slotLabel(s, langMeta(lang).locale, words)}
          </button>
        ))}
      </div>
    </div>
  );
}
