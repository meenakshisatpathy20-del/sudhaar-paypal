import crypto from "node:crypto";
import { canView } from "@/lib/access";
import { currentAccount } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { approveOrder, approveTopUp, FlowError, getOrder } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";

const sameToken = (a?: string, b?: string) => Boolean(a && b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)));

// Called from the PayPal JS SDK v6 onApprove callback: authorizes (holds) the payment.
// Allowed for the customer who booked, an admin, or a family member holding the Family Pay link.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { paypalOrderId, token, topUp } = (await req.json()) as { paypalOrderId: string; token?: string; topUp?: boolean };
    const account = currentAccount(req);
    const order = getOrder(id);
    const allowed = order && ((account && (account.role === "customer" || account.role === "admin") && canView(account, order)) || sameToken(token, order.familyPay?.token));
    if (!allowed) throw new FlowError("Order not found", 404);
    // topUp: the second hold for an approved price increase.
    return ok({ order: orderFor(account, topUp ? await approveTopUp(id, paypalOrderId) : await approveOrder(id, paypalOrderId)) });
  } catch (e) {
    return fail(e);
  }
}
