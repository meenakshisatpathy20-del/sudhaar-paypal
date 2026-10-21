"use client";

import { cn } from "@/lib/utils";

type Pin = { id: string; name: string; lat: number; lng: number; color?: string; label?: string };

/**
 * Stylised neighbourhood map in SVG (no map tiles needed): streets, a lake, the customer's home
 * at the centre and karigar pins placed by their real offset in km. Optionally animates the
 * Repair Saathi along the route between home and the chosen karigar.
 */
export function NeighbourhoodMap({
  center,
  pins,
  selected,
  onSelect,
  saathiProgress,
  className,
}: {
  center: { lat: number; lng: number };
  pins: Pin[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** 0..1 along home -> karigar -> home, or undefined to hide the Saathi. */
  saathiProgress?: number;
  className?: string;
}) {
  const W = 400;
  const H = 260;
  const KM = 40; // px per km
  const toXY = (p: { lat: number; lng: number }) => ({ x: W / 2 + ((p.lng - center.lng) / 0.0093) * KM * 0.9, y: H / 2 - ((p.lat - center.lat) / 0.009) * KM * 0.62 });
  const target = pins.find((p) => p.id === selected);
  const t = target ? toXY(target) : null;
  let saathi: { x: number; y: number } | null = null;
  if (t && saathiProgress !== undefined) {
    const f = saathiProgress <= 0.5 ? saathiProgress * 2 : 2 - saathiProgress * 2;
    saathi = { x: W / 2 + (t.x - W / 2) * f, y: H / 2 + (t.y - H / 2) * f };
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
        <text x="318" y="72" fontSize="9" fill="#1f8a7a" opacity="0.9">Lake</text>
        <path d="M 0 140 C 120 120, 240 160, 400 128" stroke="#ffffff" strokeWidth="10" fill="none" />
        <path d="M 150 0 C 170 90, 190 170, 170 260" stroke="#ffffff" strokeWidth="8" fill="none" />
        <path d="M 0 60 L 400 76" stroke="#fffaf2" strokeWidth="5" fill="none" />
        <path d="M 260 0 L 300 260" stroke="#fffaf2" strokeWidth="5" fill="none" />
        <path d="M 40 260 L 120 0" stroke="#fffaf2" strokeWidth="4" fill="none" />
        <circle cx={W / 2} cy={H / 2} r="70" fill="url(#home-glow)" />
        {t && <line x1={W / 2} y1={H / 2} x2={t.x} y2={t.y} stroke="#d9572b" strokeWidth="2" strokeDasharray="5 5" opacity="0.8" />}
        {pins.map((p) => {
          const { x, y } = toXY(p);
          const active = p.id === selected;
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
