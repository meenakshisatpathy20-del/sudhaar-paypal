"use client";

import { Check } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/types";
import { useLang } from "./LanguageProvider";

type Step = { status: OrderStatus; en: string; hi: string };

const PICKUP_STEPS: Step[] = [
  { status: "authorized", en: "Paid · money held by PayPal", hi: "भुगतान हुआ · पैसा PayPal के पास सुरक्षित" },
  { status: "picked_up", en: "Picked up (OTP)", hi: "पिकअप हुआ (OTP)" },
  { status: "at_karigar", en: "At the karigar", hi: "कारीगर के पास पहुँचा" },
  { status: "repairing", en: "Repairing", hi: "मरम्मत जारी" },
  { status: "repaired", en: "Repaired · AI photo check", hi: "मरम्मत पूरी · AI फ़ोटो जाँच" },
  { status: "out_for_delivery", en: "Out for delivery", hi: "डिलीवरी के लिए निकला" },
  { status: "delivered", en: "Delivered (OTP) · payment captured", hi: "डिलीवर हुआ (OTP) · भुगतान लिया गया" },
  { status: "paid_out", en: "Karigar & Saathi paid instantly", hi: "कारीगर और साथी को तुरंत भुगतान" },
];
const VISIT_STEPS: Step[] = [
  { status: "authorized", en: "Paid · money held by PayPal", hi: "भुगतान हुआ · पैसा PayPal के पास सुरक्षित" },
  { status: "repairing", en: "Karigar arrived (OTP) · repairing", hi: "कारीगर पहुँचे (OTP) · मरम्मत जारी" },
  { status: "repaired", en: "Repaired · AI photo check", hi: "मरम्मत पूरी · AI फ़ोटो जाँच" },
  { status: "delivered", en: "Job confirmed (OTP) · payment captured", hi: "काम पूरा (OTP) · भुगतान लिया गया" },
  { status: "paid_out", en: "Karigar paid instantly", hi: "कारीगर को तुरंत भुगतान" },
];

export function Timeline({ order }: { order: Order }) {
  const { lang } = useLang();
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
              <span className={done ? "font-semibold" : "text-muted-foreground"}>{s[lang]}</span>
              {done && at && <span className="ml-2 text-xs text-muted-foreground">{new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
