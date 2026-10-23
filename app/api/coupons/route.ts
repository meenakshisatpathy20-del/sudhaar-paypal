import { currentAccount, requireRole } from "@/lib/auth";
import { cleanCoupon, couponDiscount, normaliseCode } from "@/lib/coupons";
import { careActive } from "@/lib/care";
import { readDB, updateDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import type { Coupon } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: admins see every coupon with its usage; everyone else sees the active offers.
export function GET(req: Request) {
  const a = currentAccount(req);
  const all = readDB().coupons ?? [];
  if (a?.role === "admin") return ok({ coupons: all });
  const live = all.filter((c) => c.active && !(c.expiresAt && Date.parse(c.expiresAt) < Date.now()) && !(c.maxUses !== undefined && c.uses >= c.maxUses));
  return ok({ coupons: live.map((c) => ({ code: c.code, description: c.description, basketOnly: c.basketOnly, firstOrderOnly: c.firstOrderOnly })) });
}

// POST { action: "check", code, repairCharge, pickupFee, basket } -> preview for the customer (the booking re-checks it).
// POST { action: "save", coupon } / { action: "toggle", code } -> admin only.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string; repairCharge?: number; pickupFee?: number; basket?: boolean; coupon?: Partial<Coupon> };
    if (body.action === "check") {
      const customer = requireRole(req, "customer");
      const repairCharge = Number(body.repairCharge) || 0;
      const pickupFee = Number(body.pickupFee) || 0;
      const careCovered = careActive(customer) ? pickupFee : 0;
      return ok(couponDiscount(readDB(), body.code, { customer, repairCharge, pickupFee, careCovered, basket: Boolean(body.basket) }));
    }
    requireRole(req, "admin");
    if (body.action === "toggle") {
      const code = normaliseCode(body.code);
      const c = await updateDB((db) => {
        const x = db.coupons?.find((y) => y.code === code);
        if (!x) throw new FlowError("Coupon not found", 404);
        x.active = !x.active;
        return x;
      });
      return ok({ coupon: c });
    }
    if (body.action === "save") {
      const saved = await updateDB((db) => {
        db.coupons ??= [];
        const code = normaliseCode(body.coupon?.code);
        const i = db.coupons.findIndex((y) => y.code === code);
        const c = cleanCoupon(body.coupon ?? {}, i >= 0 ? db.coupons[i] : undefined);
        if (i >= 0) db.coupons[i] = c;
        else db.coupons.unshift(c);
        return c;
      });
      return ok({ coupon: saved }, 201);
    }
    throw new FlowError("Unknown action");
  } catch (e) {
    return fail(e);
  }
}
