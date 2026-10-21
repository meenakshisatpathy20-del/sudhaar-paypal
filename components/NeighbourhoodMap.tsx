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
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-[#081110]", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff08" strokeWidth="1" />
          </pattern>
          <radialGradient id="home-glow">
            <stop offset="0" stopColor="#2dd4bf" stopOpacity="0.35" />
            <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <path d="M 300 20 C 350 30, 380 70, 360 110 C 340 140, 290 120, 280 90 C 270 60, 270 25, 300 20 Z" fill="#0e3a4a" opacity="0.55" />
        <text x="318" y="72" fontSize="9" fill="#5fa8bf" opacity="0.8">Lake</text>
        <path d="M 0 140 C 120 120, 240 160, 400 128" stroke="#ffffff1f" strokeWidth="10" fill="none" />
        <path d="M 150 0 C 170 90, 190 170, 170 260" stroke="#ffffff17" strokeWidth="8" fill="none" />
        <path d="M 0 60 L 400 76" stroke="#ffffff10" strokeWidth="5" fill="none" />
        <path d="M 260 0 L 300 260" stroke="#ffffff10" strokeWidth="5" fill="none" />
        <path d="M 40 260 L 120 0" stroke="#ffffff0c" strokeWidth="4" fill="none" />
        <circle cx={W / 2} cy={H / 2} r="70" fill="url(#home-glow)" />
        {t && <line x1={W / 2} y1={H / 2} x2={t.x} y2={t.y} stroke="#2dd4bf" strokeWidth="2" strokeDasharray="5 5" opacity="0.8" />}
        {pins.map((p) => {
          const { x, y } = toXY(p);
          const active = p.id === selected;
          return (
            <g key={p.id} transform={`translate(${x} ${y})`} className={onSelect ? "cursor-pointer" : ""} onClick={() => onSelect?.(p.id)}>
              {active && <circle r="16" fill={p.color ?? "#2dd4bf"} opacity="0.25" />}
              <path d="M0 0 C -7 -9 -9 -13 -9 -17 A 9 9 0 1 1 9 -17 C 9 -13 7 -9 0 0 Z" fill={p.color ?? "#2dd4bf"} stroke={active ? "#fff" : "#0008"} strokeWidth={active ? 2 : 1} />
              <text y="-14" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                {p.name[0]}
              </text>
              {(active || p.label) && (
                <text y="12" textAnchor="middle" fontSize="8.5" fill="#e9f2ef" fontWeight="600">
                  {p.label ?? p.name}
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <circle r="11" fill="#fbbf24" stroke="#060a0a" strokeWidth="3" />
          <path d="M -5 1 L 0 -4 L 5 1 L 5 5 L -5 5 Z" fill="#2a1a00" />
        </g>
        {saathi && (
          <g transform={`translate(${saathi.x} ${saathi.y})`} style={{ transition: "transform 1s ease" }}>
            <circle r="13" fill="#2dd4bf" opacity="0.25" />
            <circle r="7" fill="#2dd4bf" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}
