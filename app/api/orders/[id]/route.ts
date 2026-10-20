import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError, getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const order = getOrder((await params).id);
    if (!order) throw new FlowError("Order not found", 404);
    const db = readDB();
    return ok({
      order,
      karigar: db.karigars.find((k) => k.id === order.karigarId),
      saathi: db.saathis.find((s) => s.id === order.saathiId),
      quote: db.quotes.find((q) => q.id === order.quoteId),
    });
  } catch (e) {
    return fail(e);
  }
}
