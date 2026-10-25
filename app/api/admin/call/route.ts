import { requireRole } from "@/lib/auth";
import { callbackEnabled } from "@/lib/bolna";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError, getOrder } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
import { conductCall } from "@/lib/symphony";

// Admin: have the Sudhaar agent call the payer (payment nudge) or the customer (pickup / status) right now.
export async function POST(req: Request) {
  try {
    rateLimit(req, "admin-call", 20);
    requireRole(req, "admin");
    if (!callbackEnabled()) throw new FlowError("Outbound calls need BOLNA_API_KEY and BOLNA_AGENT_ID.", 503);
    const { orderId, who } = (await req.json().catch(() => ({}))) as { orderId?: string; who?: "payer" | "customer" };
    const o = getOrder(String(orderId ?? ""));
    if (!o) throw new FlowError("Order not found", 404);
    const customer = readDB().accounts.find((a) => a.id === o.customerId)?.phone;
    const to = who === "payer" ? o.familyPay?.phone : customer;
    if (!to) throw new FlowError(who === "payer" ? "This order has no payer number." : "This customer has no number.");
    const reason = who === "payer" ? "payment_reminder" : o.status === "authorized" ? "pickup_reminder" : "status_update";
    const call = await conductCall(o, to, reason);
    return ok({ call });
  } catch (e) {
    return fail(e);
  }
}
