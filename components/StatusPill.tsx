"use client";

import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types";
import { useLang } from "./LanguageProvider";

/** English labels; also used by the (English-only) admin console. */
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

const STATUS_LABEL_HI: Record<OrderStatus, string> = {
  awaiting_payment: "भुगतान बाकी",
  authorized: "भुगतान हुआ · होल्ड पर",
  picked_up: "पिकअप हो गया",
  at_karigar: "कारीगर के पास",
  repairing: "मरम्मत जारी",
  repaired: "मरम्मत पूरी",
  out_for_delivery: "डिलीवरी के लिए निकला",
  delivered: "डिलीवर हो गया",
  paid_out: "पूरा हुआ",
  cancelled: "रद्द",
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
  const { lang } = useLang();
  return <Badge variant={variant}>{(lang === "hi" ? STATUS_LABEL_HI : STATUS_LABEL)[status]}</Badge>;
}
