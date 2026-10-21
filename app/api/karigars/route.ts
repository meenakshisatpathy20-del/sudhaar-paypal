import { readDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { customerLocation, placeNear } from "@/lib/location";
import { haversineKm } from "@/lib/pricing";
import { publicKarigar } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const at = customerLocation(req);
  const karigars = readDB()
    .karigars.map((k) => placeNear(publicKarigar(k), at))
    .map((k) => ({ ...k, distanceKm: haversineKm(at, k) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return ok({ center: { lat: at.lat, lng: at.lng }, karigars });
}
