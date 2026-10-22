import { config } from "./config";

type LatLng = { lat: number; lng: number };

/**
 * Demo only: sample karigars sit around the demo centre, so their neighbourhood is placed around
 * the customer, keeping each karigar's real offset (and so the same distance and direction).
 */
export function placeNear<T extends LatLng>(k: T, at: LatLng): T {
  return { ...k, lat: k.lat + (at.lat - config.demoCenter.lat), lng: k.lng + (at.lng - config.demoCenter.lng) };
}

export const validLatLng = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
