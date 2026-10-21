import { readDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { DEMO_CUSTOMER } from "@/lib/orders";
import { haversineKm } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export function GET() {
  const at = DEMO_CUSTOMER();
  const karigars = readDB()
    .karigars.map((k) => ({ ...k, distanceKm: haversineKm(at, k) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return ok({ center: { lat: at.lat, lng: at.lng }, karigars });
}
