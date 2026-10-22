import crypto from "node:crypto";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { expireUnpaidOrders, FlowError, getOrder } from "@/lib/orders";
import { orderFor, publicKarigar } from "@/lib/privacy";

export const dynamic = "force-dynamic";

// Family Pay: the relative opening the link has no account, so the secret token in the link is
// what lets them see this one order (without OTPs or anyone's contact details).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await expireUnpaidOrders();
    const token = new URL(req.url).searchParams.get("t") ?? "";
    const order = getOrder((await params).id);
    const expected = order?.familyPay?.token ?? "";
    if (!order || !token || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new FlowError("This payment link is not valid.", 404);
    const k = readDB().karigars.find((x) => x.id === order.karigarId);
    return ok({ order: orderFor(null, order), karigar: k && publicKarigar(k) });
  } catch (e) {
    return fail(e);
  }
}
