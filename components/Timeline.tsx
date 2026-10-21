"use client";

import { Check } from "lucide-react";
import type { StringKey } from "@/lib/i18n";
import type { Order, OrderStatus } from "@/lib/types";
import { useLang } from "./LanguageProvider";

type Step = { status: OrderStatus; key: StringKey };

const PICKUP_STEPS: Step[] = (["authorized", "picked_up", "at_karigar", "repairing", "repaired", "out_for_delivery", "delivered", "paid_out"] as const).map((status) => ({ status, key: `tl_${status}` as StringKey }));
const VISIT_STEPS: Step[] = [
  { status: "authorized", key: "tl_authorized" },
  { status: "repairing", key: "tlv_repairing" },
  { status: "repaired", key: "tl_repaired" },
  { status: "delivered", key: "tlv_delivered" },
  { status: "paid_out", key: "tlv_paid_out" },
];

export function Timeline({ order }: { order: Order }) {
  const { t } = useLang();
  const steps = order.mode === "pickup" ? PICKUP_STEPS : VISIT_STEPS;
  const currentIdx = steps.findIndex((s) => s.status === order.status);
  return (
    <ol className="relative space-y-3 pl-1">
      {steps.map((s, i) => {
        const done = currentIdx >= 0 && i <= currentIdx;
        const current = i === currentIdx && order.status !== "paid_out";
        const at = order.events.findLast((e) => e.status === s.status)?.at;
        return (
          <li key={s.status} className="relative flex items-start gap-3">
            {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-4px)] w-0.5 ${done && i < currentIdx ? "bg-primary" : "bg-muted"}`} />}
            <span className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-muted ring-1 ring-border"}`}>
              {done ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
              {current && <span className="absolute inset-0 rounded-full bg-primary/50" style={{ animation: "ping-soft 1.6s ease-out infinite" }} />}
            </span>
            <div className="flex-1 pt-0.5 text-sm">
              <span className={done ? "font-semibold" : "text-muted-foreground"}>{t(s.key)}</span>
              {done && at && <span className="ml-2 text-xs text-muted-foreground">{new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
