import { Badge } from "@/components/ui/badge";
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

export const STATUS_PROGRESS: Record<OrderStatus, number> = {
  awaiting_payment: 5,
  authorized: 15,
  picked_up: 30,
  at_karigar: 42,
  repairing: 58,
  repaired: 72,
  out_for_delivery: 85,
  delivered: 95,
  paid_out: 100,
  cancelled: 0,
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const variant = status === "paid_out" ? "solid" : status === "authorized" ? "paypal" : status === "cancelled" ? "destructive" : status === "awaiting_payment" ? "outline" : "gold";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}
