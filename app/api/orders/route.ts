import { canView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { createOrder, expireUnpaidOrders } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";

export const dynamic = "force-dynamic";

// Each account gets only its own orders: a customer's bookings, a karigar's jobs, a Saathi's trips.
export async function GET(req: Request) {
  try {
    const account = requireRole(req, "customer", "karigar", "saathi", "admin");
    await expireUnpaidOrders();
    const db = readDB();
    const orders = db.orders.filter((o) => canView(account, o));
    const quoteIds = new Set(orders.map((o) => o.quoteId));
    return ok({
      orders: orders.map((o) => orderFor(account, o)),
      quotes: Object.fromEntries(db.quotes.filter((q) => quoteIds.has(q.id)).map((q) => [q.id, { newPrice: q.newPrice, photo: q.photo }])),
      karigars: Object.fromEntries(db.karigars.map((k) => [k.id, { name: k.name, shop: k.shop, avatarColor: k.avatarColor, area: k.area }])),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const customer = requireRole(req, "customer");
    const body = (await req.json()) as { quoteId: string; karigarId: string; donation?: number; familyPay?: { name: string; relation: string; email?: string } };
    const order = await createOrder({ customer, quoteId: body.quoteId, karigarId: body.karigarId, donation: body.donation, familyPay: body.familyPay });
    return ok({ order: orderFor(customer, order), paypalOrderId: order.paypal.orderId }, 201);
  } catch (e) {
    return fail(e);
  }
}
