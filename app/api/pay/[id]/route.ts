import crypto from "node:crypto";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { decidePriceChange, expireUnpaidOrders, FlowError, getOrder } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
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

const validToken = (token: string, expected: string) => Boolean(token && expected && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)));

// The same link answers the karigar's price change after inspection, so a phone customer or the
// family member who pays can approve or decline it without an account.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "pay-link", 30);
    const { t, approve } = (await req.json().catch(() => ({}))) as { t?: string; approve?: boolean };
    const order = getOrder((await params).id);
    if (!order || !validToken(String(t ?? ""), order.familyPay?.token ?? "")) throw new FlowError("This payment link is not valid.", 404);
    return ok({ order: orderFor(null, await decidePriceChange(order.id, Boolean(approve))) });
  } catch (e) {
    return fail(e);
  }
}
