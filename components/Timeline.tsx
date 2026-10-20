import type { Order, OrderStatus } from "@/lib/types";

const PICKUP_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "authorized", label: "Paid · money held by PayPal" },
  { status: "picked_up", label: "Picked up (OTP)" },
  { status: "at_karigar", label: "At karigar" },
  { status: "repairing", label: "Repairing" },
  { status: "repaired", label: "Repaired · AI photo check" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered (OTP) · payment captured" },
  { status: "paid_out", label: "Karigar & Saathi paid instantly" },
];
const VISIT_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "authorized", label: "Paid · money held by PayPal" },
  { status: "repairing", label: "Karigar arrived (OTP) · repairing" },
  { status: "repaired", label: "Repaired · AI photo check" },
  { status: "delivered", label: "Job confirmed (OTP) · payment captured" },
  { status: "paid_out", label: "Karigar paid instantly" },
];

export function Timeline({ order }: { order: Order }) {
  const steps = order.mode === "pickup" ? PICKUP_STEPS : VISIT_STEPS;
  const reached = new Set(order.events.map((e) => e.status).filter(Boolean));
  const currentIdx = steps.findIndex((s) => s.status === order.status);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const done = reached.has(s.status) && (currentIdx === -1 || i <= currentIdx || order.status === "paid_out");
        const at = order.events.findLast((e) => e.status === s.status)?.at;
        return (
          <li key={s.status} className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${done ? "bg-brand" : "border-2 border-line bg-white"}`} />
            <div className="flex-1 text-sm">
              <span className={done ? "font-semibold" : "text-muted"}>{s.label}</span>
              {done && at && <span className="ml-2 text-xs text-muted">{new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
