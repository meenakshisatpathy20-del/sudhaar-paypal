import type { Category, ItemSize, Karigar, ServiceMode } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  shoes: "Shoes",
  bags: "Bags",
  clothes: "Clothes",
  "small-appliance": "Mixer, fan, iron",
  electronics: "Phone & gadgets",
  furniture: "Furniture",
  plumbing: "Plumbing",
  electrical: "Electrical",
};

export const HOME_VISIT_CATEGORIES: Category[] = ["plumbing", "electrical"];

export function serviceModeFor(category: Category): ServiceMode {
  return HOME_VISIT_CATEGORIES.includes(category) ? "home-visit" : "pickup";
}

/** Shiprocket-style rate card: distance zone x item size. USD (PayPal sandbox currency). */
export const PICKUP_RATE_CARD: { maxKm: number; label: string; fee: Record<ItemSize, number> }[] = [
  { maxKm: 2, label: "0–2 km", fee: { small: 1.0, medium: 1.5, large: 3.0 } },
  { maxKm: 5, label: "2–5 km", fee: { small: 1.5, medium: 2.0, large: 3.5 } },
  { maxKm: 8, label: "5–8 km", fee: { small: 2.0, medium: 2.5, large: 4.5 } },
];
export const HOME_VISIT_FEE = 1.5;
export const MAX_SERVICE_KM = 8;

export function pickupFee(distanceKm: number, size: ItemSize, mode: ServiceMode): number | null {
  if (mode === "home-visit") return distanceKm <= MAX_SERVICE_KM ? HOME_VISIT_FEE : null;
  const zone = PICKUP_RATE_CARD.find((z) => distanceKm <= z.maxKm);
  return zone ? zone.fee[size] : null;
}

export const SPLIT = {
  karigarShareOfRepair: 0.9,
  saathiShareOfPickup: 0.75,
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** PayPal sandbox settles in USD; customers see rupees at this approximate rate. */
export const INR_PER_USD = 85;

export function computeSplit(repairCharge: number, fee: number, donation: number) {
  const karigar = round2(repairCharge * SPLIT.karigarShareOfRepair);
  const saathi = round2(fee * SPLIT.saathiShareOfPickup);
  const total = round2(repairCharge + fee + donation);
  // Platform keeps the remainder; donation goes to the karigar tool fund (held by the platform).
  const platform = round2(total - karigar - saathi - donation);
  return { karigar, saathi, platform, donation: round2(donation), total };
}

/** Karigar-specific price: midpoint of the AI range, scaled by the karigar's price factor. */
export function karigarPrice(repairLow: number, repairHigh: number, k: Karigar) {
  return round2(((repairLow + repairHigh) / 2) * k.priceFactor);
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return round2(2 * R * Math.asin(Math.sqrt(h)));
}

/** Reference prices used by the simulated AI and to sanity-check AI quotes. */
export const REFERENCE: Record<Category, { repair: [number, number]; newPrice: number; size: ItemSize; days: number }> = {
  shoes: { repair: [2, 5], newPrice: 18, size: "small", days: 1 },
  bags: { repair: [2, 4], newPrice: 15, size: "small", days: 1 },
  clothes: { repair: [1, 3], newPrice: 12, size: "small", days: 1 },
  "small-appliance": { repair: [3, 7], newPrice: 25, size: "medium", days: 1 },
  electronics: { repair: [6, 20], newPrice: 120, size: "small", days: 2 },
  furniture: { repair: [6, 18], newPrice: 60, size: "large", days: 3 },
  plumbing: { repair: [4, 10], newPrice: 0, size: "medium", days: 0 },
  electrical: { repair: [3, 8], newPrice: 0, size: "medium", days: 0 },
};

/** Rough weight per item, used for the "kg kept out of landfill" impact counter. */
export const AVG_ITEM_KG: Record<Category, number> = {
  shoes: 0.8,
  bags: 0.7,
  clothes: 0.4,
  "small-appliance": 2.5,
  electronics: 0.3,
  furniture: 9,
  plumbing: 0,
  electrical: 0,
};

export const fmt = (n: number) => `$${n.toFixed(2)}`;

/** Ghar Safai basket: one Saathi trip collects everything. Fee = the farthest/largest single
 * pickup fee plus $0.50 for every extra karigar stop on the route. */
export function basketPickupFee(fees: number[], karigarStops: number) {
  if (fees.length === 0) return 0;
  return round2(Math.max(...fees) + Math.max(0, karigarStops - 1) * 0.5);
}
