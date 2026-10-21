import { FlowError } from "./orders";
import type { Account, Order } from "./types";

// Who may see or change an order. Every order API goes through these checks.

const forKarigar = (a: Account, o: Order) => Boolean(a.karigarId) && (o.karigarId === a.karigarId || Boolean(o.jobs?.some((j) => j.karigarId === a.karigarId)));
const forSaathi = (a: Account, o: Order) => Boolean(a.saathiId) && o.mode === "pickup" && o.saathiId === a.saathiId;

export function canView(a: Account, o: Order) {
  if (a.role === "admin") return true;
  if (a.role === "customer") return o.customerId === a.id;
  if (a.role === "karigar") return forKarigar(a, o) && o.status !== "awaiting_payment" && o.status !== "cancelled";
  return forSaathi(a, o) && o.status !== "awaiting_payment" && o.status !== "cancelled";
}

export function assertCanView(a: Account, o: Order | undefined): asserts o is Order {
  // Same message for "missing" and "not yours", so order ids can't be probed.
  if (!o || !canView(a, o)) throw new FlowError("Order not found", 404);
}

type Action = "pickup" | "drop_at_karigar" | "start_repair" | "mark_repaired" | "out_for_delivery" | "deliver" | "cancel";

/** Which role performs each step. Home visits have no Saathi: the karigar confirms the job-done OTP. */
export function assertCanAct(a: Account, o: Order, action: Action, jobId?: string) {
  assertCanView(a, o);
  if (a.role === "admin") return;
  const ok =
    action === "cancel"
      ? a.role === "customer"
      : action === "start_repair" || action === "mark_repaired"
        ? a.role === "karigar" && (jobId ? o.jobs?.find((j) => j.id === jobId)?.karigarId === a.karigarId : o.karigarId === a.karigarId)
        : o.mode === "home-visit"
          ? a.role === "karigar" && o.karigarId === a.karigarId
          : a.role === "saathi";
  if (!ok) throw new FlowError("Your account can't do this step.", 403);
}
