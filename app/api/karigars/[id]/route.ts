import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { customerLocation, placeNear } from "@/lib/location";
import { FlowError } from "@/lib/orders";
import { haversineKm } from "@/lib/pricing";
import { publicKarigar } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = readDB();
    const k = db.karigars.find((x) => x.id === id);
    if (!k) throw new FlowError("Karigar not found", 404);
    const done = db.orders.filter((o) => o.karigarId === k.id && o.paypal.captureId).length;
    const at = customerLocation(req);
    const placed = placeNear(publicKarigar(k), at);
    return ok({ karigar: { ...placed, distanceKm: haversineKm(at, placed) }, center: at, completedOnSudhaar: done });
  } catch (e) {
    return fail(e);
  }
}
