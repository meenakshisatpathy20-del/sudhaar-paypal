import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { createOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({ orders: readDB().orders });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { quoteId: string; karigarId: string; donation?: number };
    const order = await createOrder({ quoteId: body.quoteId, karigarId: body.karigarId, donation: body.donation });
    return ok({ order, paypalOrderId: order.paypal.orderId }, 201);
  } catch (e) {
    return fail(e);
  }
}
