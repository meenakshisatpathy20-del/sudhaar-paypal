import { placeNear } from "./geo";
import { haversineKm, round2 } from "./pricing";
import type { DB, Order, OrderStatus, SaathiLocation, SaathiVehicle } from "./types";

// Shiprocket-style tracking: every order has a tracking link, a step-by-step timeline, the Saathi's
// live position (from the Saathi app) and an ETA to the next stop.

type LatLng = { lat: number; lng: number };

const KMH: Record<SaathiVehicle, number> = { walk: 5, bicycle: 12, scooter: 22, motorbike: 25 };
/** A position older than this is not "live" any more. */
const FRESH_MS = 10 * 60 * 1000;

export function liveLocation(db: DB, saathiId: string): SaathiLocation | undefined {
  const loc = db.saathiLocations?.[saathiId];
  return loc && Date.now() - Date.parse(loc.at) < FRESH_MS ? loc : undefined;
}

/** Statuses where the Saathi is (or is about to be) on the road for this order. */
const MOVING: OrderStatus[] = ["authorized", "picked_up", "out_for_delivery"];

/** Where the Saathi goes next for this order, and why. */
export function nextStop(db: DB, o: Order): { kind: "pickup" | "drop" | "delivery"; label: string; at: LatLng } | null {
  if (o.mode !== "pickup") return null;
  const home = { lat: o.customer.lat, lng: o.customer.lng };
  const k = db.karigars.find((x) => x.id === o.karigarId);
  const shop = k ? placeNear({ lat: k.lat, lng: k.lng }, home) : home;
  if (o.status === "authorized") return { kind: "pickup", label: `Pickup at ${o.customer.name.split(" ")[0]}'s home`, at: home };
  if (o.status === "picked_up") return { kind: "drop", label: `Drop at ${k?.shop ?? "the karigar"}`, at: shop };
  if (o.status === "out_for_delivery") return { kind: "delivery", label: `Delivery to ${o.customer.name.split(" ")[0]}'s home`, at: home };
  return null;
}

export type LiveTracking = {
  lat: number;
  lng: number;
  at: string;
  simulated: boolean;
  /** Minutes to the next stop; null when the Saathi isn't heading to one for this order. */
  etaMin: number | null;
  kmToGo: number | null;
  nextStop: string | null;
  vehicle: SaathiVehicle;
};

export function liveFor(db: DB, o: Order): LiveTracking | null {
  if (o.mode !== "pickup" || !MOVING.includes(o.status)) return null;
  const loc = liveLocation(db, o.saathiId);
  if (!loc) return null;
  const vehicle = db.saathis.find((s) => s.id === o.saathiId)?.vehicle ?? "bicycle";
  const stop = nextStop(db, o);
  const km = stop ? haversineKm(loc, stop.at) : null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    at: loc.at,
    simulated: Boolean(loc.simulated),
    etaMin: km === null ? null : Math.max(1, Math.round((km / KMH[vehicle]) * 60 + (km < 0.05 ? 0 : 2))),
    kmToGo: km === null ? null : round2(km),
    nextStop: stop?.label ?? null,
    vehicle,
  };
}

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "authorized", label: "Booked · payment held by PayPal" },
  { key: "picked_up", label: "Picked up by Repair Saathi" },
  { key: "at_karigar", label: "Reached the karigar" },
  { key: "repairing", label: "Repair in progress" },
  { key: "repaired", label: "Repaired · photo checked" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered · OTP verified" },
  { key: "paid_out", label: "Karigar and Saathi paid" },
];
const VISIT_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "authorized", label: "Booked · payment held by PayPal" },
  { key: "repairing", label: "Karigar arrived · repair started" },
  { key: "repaired", label: "Repaired · photo checked" },
  { key: "delivered", label: "Job done · OTP verified" },
  { key: "paid_out", label: "Karigar paid" },
];

/** The timeline: each step with the time it happened (from the order's own status events). */
export function trackingSteps(o: Order) {
  const steps = o.mode === "pickup" ? STEPS : VISIT_STEPS;
  const reached = new Map<OrderStatus, string>();
  for (const e of o.events) if (e.status && !reached.has(e.status)) reached.set(e.status, e.at);
  const order = steps.map((s) => s.key);
  const current = o.status === "cancelled" ? -1 : order.indexOf(o.status);
  return steps.map((s, i) => ({ key: s.key, label: s.label, at: reached.get(s.key) ?? null, done: current >= i || (current === -1 && reached.has(s.key)) }));
}

/** Everything the public tracking page shows. No OTPs, emails, prices or exact home address. */
export function publicTracking(db: DB, o: Order) {
  const home = { lat: o.customer.lat, lng: o.customer.lng };
  const k = db.karigars.find((x) => x.id === o.karigarId);
  const s = db.saathis.find((x) => x.id === o.saathiId);
  const shops = [...new Set(o.jobs?.length ? o.jobs.map((j) => j.karigarId) : [o.karigarId])]
    .map((id) => db.karigars.find((x) => x.id === id))
    .filter(Boolean)
    .map((kk) => ({ shop: kk!.shop, area: kk!.area, ...placeNear({ lat: kk!.lat, lng: kk!.lng }, home) }));
  return {
    id: o.id,
    item: o.item,
    status: o.status,
    mode: o.mode,
    createdAt: o.createdAt,
    pickupSlot: o.pickupSlot,
    steps: trackingSteps(o),
    karigar: k ? { shop: k.shop, name: k.name, area: k.area } : null,
    shops,
    saathi: o.mode === "pickup" && s ? { name: s.name.split(" ")[0], vehicle: s.vehicle ?? "bicycle", rating: s.rating } : null,
    // Rounded to about 100 m: enough for the map, without publishing the exact address.
    home: { lat: Math.round(home.lat * 1000) / 1000, lng: Math.round(home.lng * 1000) / 1000 },
    live: liveFor(db, o),
  };
}
