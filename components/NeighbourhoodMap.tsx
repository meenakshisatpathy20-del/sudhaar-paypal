"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

export type Pin = { id: string; name: string; lat: number; lng: number; color?: string; label?: string };

export type MapProps = {
  center: { lat: number; lng: number };
  pins: Pin[];
  selected?: string | null;
  /** Karigar ids the Saathi visits in order (Ghar Safai). Defaults to the selected pin. */
  route?: string[];
  onSelect?: (id: string) => void;
  /** 0..1 along home -> karigar -> home, or undefined to hide the Saathi. */
  saathiProgress?: number;
  /** The Saathi's real (live) position from the Saathi app; shown instead of saathiProgress. */
  saathiAt?: { lat: number; lng: number; label?: string } | null;
  /** Draw this path instead of home -> route -> home (the Saathi's planned route). */
  path?: { lat: number; lng: number }[];
  /** Hide the customer's home marker (e.g. the admin fleet map). */
  hideHome?: boolean;
  className?: string;
};

// Leaflet touches `window` when it loads, so the real map is rendered in the browser only.
const RealMap = dynamic(() => import("./RealMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f6ead6]" />,
});

/**
 * OpenStreetMap of the customer's neighbourhood: their home, karigar pins, and optionally the
 * Repair Saathi moving along the route home -> each karigar in `route` (or the selected one) -> home.
 */
export function NeighbourhoodMap({ className, ...props }: MapProps) {
  return (
    <div className={cn("relative z-0 overflow-hidden rounded-2xl border border-border bg-[#f6ead6]", className)}>
      <RealMap {...props} />
    </div>
  );
}
