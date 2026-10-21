import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { expireUnpaidOrders, FlowError, getOrder } from "@/lib/orders";
import { publicKarigar, publicOrder } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await expireUnpaidOrders();
    const order = getOrder((await params).id);
    if (!order) throw new FlowError("Order not found", 404);
    const db = readDB();
    const karigar = db.karigars.find((k) => k.id === order.karigarId);
    return ok({
      order: publicOrder(order),
      karigar: karigar && publicKarigar(karigar),
      saathi: db.saathis.find((s) => s.id === order.saathiId),
      quote: db.quotes.find((q) => q.id === order.quoteId),
      jobKarigars: Object.fromEntries(
        (order.jobs ?? []).map((j) => {
          const k = db.karigars.find((x) => x.id === j.karigarId);
          return [j.karigarId, { name: k?.name ?? "", shop: k?.shop ?? "", avatarColor: k?.avatarColor ?? "#d9572b", lat: k?.lat ?? 0, lng: k?.lng ?? 0 }];
        }),
      ),
    });
  } catch (e) {
    return fail(e);
  }
}
