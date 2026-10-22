import { assertCanAct } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { advance, getOrder, type Action } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "action", 120);
    const account = requireRole(req, "customer", "karigar", "saathi", "admin");
    const { id } = await params;
    const body = (await req.json()) as { action: Action; otp?: string; afterPhoto?: string; jobId?: string };
    assertCanAct(account, getOrder(id)!, body.action, body.jobId);
    const order = await advance(id, body.action, { otp: body.otp, afterPhoto: body.afterPhoto, jobId: body.jobId });
    return ok({ order: orderFor(account, order) });
  } catch (e) {
    return fail(e);
  }
}
