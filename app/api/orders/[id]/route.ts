import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { expireUnpaidOrders, getOrder } from "@/lib/orders";
import { placeNear } from "@/lib/location";
import { orderFor, publicKarigar } from "@/lib/privacy";
import { liveFor, trackingSteps } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = requireRole(req, "customer", "karigar", "saathi", "admin");
    await expireUnpaidOrders();
    const order = getOrder((await params).id);
    assertCanView(account, order);
    const db = readDB();
    const karigar = db.karigars.find((k) => k.id === order.karigarId);
    return ok({
      order: orderFor(account, order),
      karigar: karigar && placeNear(publicKarigar(karigar), order.customer),
      saathi: ((s) => s && { id: s.id, name: s.name, rating: s.rating })(db.saathis.find((s) => s.id === order.saathiId)),
      quote: db.quotes.find((q) => q.id === order.quoteId),
      // The Saathi's live position and ETA while this item is on the road, and the tracking timeline.
      live: liveFor(db, order),
      steps: trackingSteps(order),
      trackUrl: order.trackToken && (account.role === "customer" || account.role === "admin") ? `/track/${order.id}?t=${order.trackToken}` : undefined,
      jobKarigars: Object.fromEntries(
        (order.jobs ?? []).map((j) => {
          const k = db.karigars.find((x) => x.id === j.karigarId);
          const at = k ? placeNear(k, order.customer) : { lat: 0, lng: 0 };
          return [j.karigarId, { name: k?.name ?? "", shop: k?.shop ?? "", avatarColor: k?.avatarColor ?? "#d9572b", lat: at.lat, lng: at.lng }];
        }),
      ),
    });
  } catch (e) {
    return fail(e);
  }
}
