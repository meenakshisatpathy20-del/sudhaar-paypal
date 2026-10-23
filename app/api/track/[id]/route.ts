import crypto from "node:crypto";
import { currentAccount } from "@/lib/auth";
import { canView } from "@/lib/access";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { publicTracking } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// Public tracking (/track/ID?t=TOKEN): anyone with the link, e.g. a family member, can follow the
// repair without logging in. The token is part of the link, so order ids alone reveal nothing.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get("t") ?? "";
    const db = readDB();
    const o = db.orders.find((x) => x.id === id);
    const account = currentAccount(req);
    const viaToken = Boolean(o?.trackToken && token.length === o.trackToken.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(o.trackToken)));
    if (!o || o.status === "awaiting_payment" || !(viaToken || (account && canView(account, o)))) throw new FlowError("Tracking link not found", 404);
    return ok({ tracking: publicTracking(db, o) });
  } catch (e) {
    return fail(e);
  }
}
