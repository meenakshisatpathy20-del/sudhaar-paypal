import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getOrder, rateKarigar } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";
import { rateLimit } from "@/lib/ratelimit";

// The customer who booked rates each karigar on their delivered order.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "rate", 20);
    const customer = requireRole(req, "customer");
    const { id } = await params;
    assertCanView(customer, getOrder(id));
    const body = (await req.json()) as { karigarId?: string; stars?: number; text?: string };
    return ok({ order: orderFor(customer, await rateKarigar(id, { karigarId: String(body.karigarId ?? ""), stars: Number(body.stars), text: typeof body.text === "string" ? body.text : "" })) });
  } catch (e) {
    return fail(e);
  }
}
