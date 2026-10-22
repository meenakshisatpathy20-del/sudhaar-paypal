import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getOrder, startTip } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";
import { rateLimit } from "@/lib/ratelimit";

// Starts a thank-you tip; the customer then approves it in the PayPal popup (see approve route).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "tip", 20);
    const customer = requireRole(req, "customer");
    const { id } = await params;
    assertCanView(customer, getOrder(id));
    const body = (await req.json()) as { karigarId?: string; inr?: number };
    return ok({ order: orderFor(customer, await startTip(id, { karigarId: String(body.karigarId ?? ""), inr: Number(body.inr) })) });
  } catch (e) {
    return fail(e);
  }
}
