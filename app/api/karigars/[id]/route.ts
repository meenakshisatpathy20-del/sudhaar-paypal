import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { customerLocation } from "@/lib/location";
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
    return ok({ karigar: { ...publicKarigar(k), distanceKm: haversineKm(customerLocation(req), k) }, completedOnSudhaar: done });
  } catch (e) {
    return fail(e);
  }
}
