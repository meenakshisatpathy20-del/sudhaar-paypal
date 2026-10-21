import { fail, ok } from "@/lib/http";
import { createBasketOrder } from "@/lib/orders";

// Ghar Safai Mode: several items -> one Saathi trip -> one PayPal order (AUTHORIZE) -> split payouts.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      items: { quoteId: string; karigarId: string }[];
      donation?: number;
      familyPay?: { name: string; relation: string; email?: string };
    };
    const order = await createBasketOrder({ items: body.items, donation: body.donation, familyPay: body.familyPay });
    return ok({ order, paypalOrderId: order.paypal.orderId }, 201);
  } catch (e) {
    return fail(e);
  }
}
