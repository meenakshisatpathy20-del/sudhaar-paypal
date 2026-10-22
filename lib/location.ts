import { currentAccount } from "./auth";
import { config } from "./config";

export { placeNear, validLatLng } from "./geo";

// Where distances and maps are measured from: the logged-in customer's saved location, else the
// demo neighbourhood. Sample karigars (and demo-onboarded ones) sit around the demo centre, so for
// the demo their neighbourhood is placed around the customer, keeping every karigar's real offset:
// a judge anywhere sees the same distances and map. Real karigars would have real coordinates.

type LatLng = { lat: number; lng: number };

export function customerLocation(req: Request): LatLng {
  const a = currentAccount(req);
  if (a?.role === "customer" && a.lat !== undefined && a.lng !== undefined) return { lat: a.lat, lng: a.lng };
  return { lat: config.demoCenter.lat, lng: config.demoCenter.lng };
}
