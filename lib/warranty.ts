import type { Order } from "./types";

// Repair warranty: 15 days from delivery, 30 days when the booking was covered by Sudhaar Care.
// Shared by the server (which refuses late claims) and the Resolve Hub page.

export const warrantyDays = (o: Pick<Order, "discount">) => (o.discount?.care ? 30 : 15);

/** When the item was delivered (the warranty starts then), or null if it hasn't been. */
export function deliveredAt(o: Pick<Order, "events">): string | null {
  return o.events.find((e) => e.status === "delivered")?.at ?? o.events.find((e) => e.status === "paid_out")?.at ?? null;
}

export function warrantyEndsAt(o: Pick<Order, "events" | "discount">): number | null {
  const at = deliveredAt(o);
  return at ? Date.parse(at) + warrantyDays(o) * 86400_000 : null;
}

/** Whole days of warranty left (0 on the last day), or -1 when it has ended or not started. */
export function warrantyDaysLeft(o: Pick<Order, "events" | "discount">, now = Date.now()): number {
  const end = warrantyEndsAt(o);
  if (end === null || now > end) return -1;
  return Math.floor((end - now) / 86400_000);
}
