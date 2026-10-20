import { fail, ok } from "@/lib/http";
import { approveOrder } from "@/lib/orders";

// Called from the PayPal JS SDK v6 onApprove callback: authorizes (holds) the payment.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { paypalOrderId } = (await req.json()) as { paypalOrderId: string };
    return ok({ order: await approveOrder((await params).id, paypalOrderId) });
  } catch (e) {
    return fail(e);
  }
}
