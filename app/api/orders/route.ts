import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { createOrder, expireUnpaidOrders } from "@/lib/orders";
import { publicOrder } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export async function GET() {
  await expireUnpaidOrders();
  const db = readDB();
  return ok({
    orders: db.orders.map(publicOrder),
    quotes: Object.fromEntries(db.quotes.map((q) => [q.id, { newPrice: q.newPrice, photo: q.photo }])),
    karigars: Object.fromEntries(db.karigars.map((k) => [k.id, { name: k.name, shop: k.shop, avatarColor: k.avatarColor }])),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { quoteId: string; karigarId: string; donation?: number; familyPay?: { name: string; relation: string; email?: string } };
    const order = await createOrder({ quoteId: body.quoteId, karigarId: body.karigarId, donation: body.donation, familyPay: body.familyPay });
    return ok({ order, paypalOrderId: order.paypal.orderId }, 201);
  } catch (e) {
    return fail(e);
  }
}
