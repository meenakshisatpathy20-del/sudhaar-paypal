import { currentAccount } from "./auth";
import { DEMO_CUSTOMER } from "./orders";

/** Where distances are measured from: the logged-in customer's saved location, else the demo neighbourhood. */
export function customerLocation(req: Request) {
  const a = currentAccount(req);
  if (a?.role === "customer" && a.lat !== undefined && a.lng !== undefined) return { lat: a.lat, lng: a.lng };
  const d = DEMO_CUSTOMER();
  return { lat: d.lat, lng: d.lng };
}
