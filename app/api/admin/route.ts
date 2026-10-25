import { smsProvider } from "@/lib/sms";
import { requireRole } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { expireUnpaidOrders, impactStats } from "@/lib/orders";
import { round2 } from "@/lib/pricing";
import { adminKarigar } from "@/lib/privacy";
import { liveLocation } from "@/lib/tracking";
import { CARE_PRICE_USD } from "@/lib/pricing";
import { bolnaConfig, callbackEnabled } from "@/lib/bolna";

export const dynamic = "force-dynamic";

// Admin console data: everything, for signed-in admins only.
export async function GET(req: Request) {
  try {
    requireRole(req, "admin");
    await expireUnpaidOrders();
    const db = readDB();
    const accounts = db.accounts.map((a) => ({ id: a.id, role: a.role, name: a.name, phone: `•••••• ${a.phone.slice(-4)}`, createdAt: a.createdAt, demo: a.demo ?? false, care: a.care?.status ?? null }));

    // Where the money is right now, straight from each order's PayPal state.
    const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
    const held = sum(db.orders.filter((o) => o.paypal.authorizationId && !o.paypal.captureId && o.status !== "cancelled").map((o) => o.paypal.heldAmount ?? o.total));
    const captured = sum(db.orders.map((o) => (o.paypal.captureId ? (o.paypal.capturedAmount ?? o.total) : 0) + (o.priceChange?.topUp?.captureId ? o.priceChange.topUp.amount : 0)));
    const tipsIn = sum(db.orders.flatMap((o) => (o.tips ?? []).filter((t) => t.status === "paid").map((t) => t.amount)));
    const paidOut = sum(db.orders.flatMap((o) => o.payouts.map((p) => p.amount)));
    const refunded = sum(db.orders.flatMap((o) => o.paypal.refunds.map((r) => r.amount)));
    const discounts = sum(db.orders.filter((o) => o.paypal.captureId).map((o) => (o.discount?.care ?? 0) + (o.discount?.coupon?.amount ?? 0)));
    const careMembers = db.accounts.filter((a) => a.care?.status === "ACTIVE").length;
    const money = { held, captured, tipsIn, paidOut, refunded, discounts, careMembers, careMonthly: round2(careMembers * CARE_PRICE_USD) };

    // Every PayPal call the app made, newest first (from the order logs), for the "PayPal activity" tab.
    const paypalActivity = db.orders
      .flatMap((o) => o.events.filter((e) => e.kind === "paypal" || (e.kind === "error" && /PayPal|Capture|Payout|Refund|Invoice|Authorization/i.test(e.message))).map((e) => ({ at: e.at, orderId: o.id, message: e.message, ref: e.ref ?? "", error: e.kind === "error" })))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80);

    // Live fleet: each Saathi's last position (if shared in the last 10 minutes) and current trips.
    const fleet = db.saathis.map((s) => {
      const loc = liveLocation(db, s.id);
      return {
        id: s.id,
        name: s.name,
        vehicle: s.vehicle ?? "bicycle",
        online: !(db.offline ?? []).includes(s.id),
        trips: db.orders.filter((o) => o.saathiId === s.id && o.mode === "pickup" && ["authorized", "picked_up", "out_for_delivery", "repaired"].includes(o.status)).length,
        location: loc ? { lat: loc.lat, lng: loc.lng, at: loc.at, simulated: Boolean(loc.simulated) } : null,
      };
    });

    return ok({
      orders: db.orders,
      karigars: db.karigars.map(adminKarigar),
      saathis: db.saathis,
      accounts,
      webhooks: db.webhooks.slice(-50).reverse(),
      impact: impactStats(),
      money,
      paypalActivity,
      fleet,
      coupons: db.coupons ?? [],
      carePlan: db.care ?? null,
      // Bolna phone line: what's configured (never the secrets), recent calls and phone bookings.
      voice: {
        functions: Boolean((process.env.VOICE_API_TOKEN ?? "").trim()),
        callback: callbackEnabled(),
        phoneNumber: bolnaConfig().phoneNumber || null,
        calls: db.voiceCalls ?? [],
        sms: { provider: smsProvider(), log: (db.smsLog ?? []).slice(0, 60) },
      },
    });
  } catch (e) {
    return fail(e);
  }
}
