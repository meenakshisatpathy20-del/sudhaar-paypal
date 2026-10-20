import type { OrderStatus } from "@/lib/types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  authorized: "Paid · on hold",
  picked_up: "Picked up",
  at_karigar: "At karigar",
  repairing: "Repairing",
  repaired: "Repaired",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  paid_out: "Completed",
  cancelled: "Cancelled",
};

const COLOR: Partial<Record<OrderStatus, string>> = {
  awaiting_payment: "bg-gray-100 text-gray-700",
  authorized: "bg-[#e8f0fe] text-[#003087]",
  paid_out: "bg-brand text-white",
  cancelled: "bg-red-100 text-red-700",
  delivered: "bg-brand-light text-brand-dark",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`pill whitespace-nowrap ${COLOR[status] ?? "bg-accent-light text-amber-800"}`}>{STATUS_LABEL[status]}</span>;
}
