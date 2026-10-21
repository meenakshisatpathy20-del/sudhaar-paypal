"use client";

import { cn } from "@/lib/utils";

type Pin = { id: string; name: string; lat: number; lng: number; color?: string; label?: string };

/**
 * Stylised neighbourhood map in SVG (no map tiles needed): streets, a lake, the customer's home
 * at the centre and karigar pins placed by their real offset in km. Optionally animates the
 * Repair Saathi along the route: home -> each karigar in `route` (or the selected one) -> home.
 */
export function NeighbourhoodMap({
  center,
  pins,
  selected,
  route,
  onSelect,
  saathiProgress,
  className,
}: {
  center: { lat: number; lng: number };
  pins: Pin[];
  selected?: string | null;
  /** Karigar ids the Saathi visits in order (Ghar Safai). Defaults to the selected pin. */
  route?: string[];
  onSelect?: (id: string) => void;
  /** 0..1 along home -> karigar -> home, or undefined to hide the Saathi. */
  saathiProgress?: number;
  className?: string;
}) {
  const W = 400;
  const H = 260;
  const KM = 40; // px per km at zoom 1
  const raw = (p: { lat: number; lng: number }) => ({ dx: ((p.lng - center.lng) / 0.0093) * KM * 0.9, dy: -((p.lat - center.lat) / 0.009) * KM * 0.62 });
  // Zoom so the farthest pin sits comfortably inside the map: spread out close karigars, fit far ones.
  const reach = Math.max(0.01, ...pins.map((p) => Math.max(Math.abs(raw(p).dx) / (W / 2 - 50), Math.abs(raw(p).dy) / (H / 2 - 35))));
  const zoom = Math.min(4, Math.max(0.4, 1 / reach));
  const toXY = (p: { lat: number; lng: number }) => {
    const { dx, dy } = raw(p);
    return { x: W / 2 + dx * zoom, y: H / 2 + dy * zoom };
  };
  const home = { x: W / 2, y: H / 2 };
  const stops = (route ?? (selected ? [selected] : [])).map((id) => pins.find((p) => p.id === id)).filter((p): p is Pin => Boolean(p));
  const path = stops.length ? [home, ...stops.map(toXY), home] : [];
  const onRoute = new Set(stops.map((p) => p.id));
  // Progress 0..0.5 runs from home through every karigar stop; 0.5..1 is the ride back home.
  let saathi: { x: number; y: number } | null = null;
  if (path.length && saathiProgress !== undefined) {
    const p = Math.min(1, Math.max(0, saathiProgress));
    saathi = p <= 0.5 ? along(path.slice(0, -1), p * 2) : along(path.slice(-2), p * 2 - 1);
  }
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-[#f6ead6]", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#7a655312" strokeWidth="1" />
          </pattern>
          <radialGradient id="home-glow">
            <stop offset="0" stopColor="#f4a62a" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f4a62a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <path d="M 300 20 C 350 30, 380 70, 360 110 C 340 140, 290 120, 280 90 C 270 60, 270 25, 300 20 Z" fill="#bfe3dc" opacity="0.9" />
        <path d="M 0 140 C 120 120, 240 160, 400 128" stroke="#ffffff" strokeWidth="10" fill="none" />
        <path d="M 150 0 C 170 90, 190 170, 170 260" stroke="#ffffff" strokeWidth="8" fill="none" />
        <path d="M 0 60 L 400 76" stroke="#fffaf2" strokeWidth="5" fill="none" />
        <path d="M 260 0 L 300 260" stroke="#fffaf2" strokeWidth="5" fill="none" />
        <path d="M 40 260 L 120 0" stroke="#fffaf2" strokeWidth="4" fill="none" />
        <circle cx={W / 2} cy={H / 2} r="70" fill="url(#home-glow)" />
        {path.length > 0 && <polyline points={path.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke="#d9572b" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round" opacity="0.8" />}
        {pins.map((p) => {
          const { x, y } = toXY(p);
          const active = p.id === selected || onRoute.has(p.id);
          return (
            <g key={p.id} transform={`translate(${x} ${y})`} className={onSelect ? "cursor-pointer" : ""} onClick={() => onSelect?.(p.id)}>
              {active && <circle r="16" fill={p.color ?? "#d9572b"} opacity="0.2" />}
              <path d="M0 0 C -7 -9 -9 -13 -9 -17 A 9 9 0 1 1 9 -17 C 9 -13 7 -9 0 0 Z" fill={p.color ?? "#d9572b"} stroke="#fff" strokeWidth={active ? 2 : 1} />
              <text y="-14" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                {p.name[0]}
              </text>
              {(active || p.label) && (
                <text y="12" textAnchor="middle" fontSize="8.5" fill="#2b1d14" fontWeight="700">
                  {p.label ?? p.name}
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <circle r="11" fill="#d9572b" stroke="#fff" strokeWidth="3" />
          <path d="M -5 1 L 0 -4 L 5 1 L 5 5 L -5 5 Z" fill="#fff" />
        </g>
        {saathi && (
          <g transform={`translate(${saathi.x} ${saathi.y})`} style={{ transition: "transform 1s ease" }}>
            <circle r="13" fill="#1f8a7a" opacity="0.25" />
            <circle r="7" fill="#1f8a7a" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** The point at fraction f (0..1) of the length of a polyline. */
function along(points: { x: number; y: number }[], f: number) {
  const legs = points.slice(1).map((b, i) => Math.hypot(b.x - points[i].x, b.y - points[i].y));
  let left = f * legs.reduce((a, l) => a + l, 0);
  for (const [i, len] of legs.entries()) {
    if (left <= len) {
      const k = len ? left / len : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * k, y: points[i].y + (points[i + 1].y - points[i].y) * k };
    }
    left -= len;
  }
  return points[points.length - 1];
}
