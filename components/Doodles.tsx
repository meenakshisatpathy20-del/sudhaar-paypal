// Hand-drawn style doodles (inline SVG): warm, light, and gently animated with CSS.
// Strokes are round and slightly uneven on purpose, like sketches in a notebook.

import { cn } from "@/lib/utils";

type P = { className?: string };
const INK = "#2b1d14";

export function Diya({ className }: P) {
  return (
    <svg viewBox="0 0 120 100" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g className="doodle-flame">
        <path d="M60 14 C 52 26, 52 36, 60 42 C 68 36, 68 26, 60 14 Z" fill="#f4a62a" stroke={INK} strokeWidth="2.5" />
        <path d="M60 26 C 57 32, 57 36, 60 39 C 63 36, 63 32, 60 26 Z" fill="#fff3c4" />
      </g>
      <path d="M58 44 L 62 44 L 61 50 L 59 50 Z" fill={INK} />
      <path d="M18 52 C 30 50, 90 50, 102 52 C 98 72, 80 84, 60 84 C 40 84, 22 72, 18 52 Z" fill="#d9572b" stroke={INK} strokeWidth="2.8" />
      <path d="M30 62 C 45 66, 75 66, 90 62" stroke="#ffd7a8" strokeWidth="3" />
      <circle cx="44" cy="72" r="2.2" fill="#ffd7a8" />
      <circle cx="60" cy="75" r="2.2" fill="#ffd7a8" />
      <circle cx="76" cy="72" r="2.2" fill="#ffd7a8" />
    </svg>
  );
}

export function NeedleThread({ className }: P) {
  return (
    <svg viewBox="0 0 160 90" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 70 L 70 18" stroke={INK} strokeWidth="3.2" />
      <ellipse cx="66" cy="22" rx="3" ry="6" transform="rotate(42 66 22)" stroke={INK} strokeWidth="2" fill="#fff" />
      <path
        className="doodle-draw"
        style={{ ["--len" as string]: "320" }}
        d="M66 22 C 90 6, 110 40, 92 52 C 76 62, 100 82, 124 66 C 140 56, 150 64, 150 74"
        stroke="#d9572b"
        strokeWidth="3"
        strokeDasharray="320"
      />
    </svg>
  );
}

export function Chappal({ className }: P) {
  return (
    <svg viewBox="0 0 120 90" className={cn("doodle-wiggle", className)} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 60 C 18 40, 40 22, 70 24 C 96 26, 108 44, 100 58 C 92 70, 40 74, 22 60 Z" fill="#f4a62a" stroke={INK} strokeWidth="2.8" />
      <path d="M44 34 C 52 46, 72 46, 80 32" stroke="#d9572b" strokeWidth="5" />
      <circle cx="62" cy="40" r="3" fill={INK} />
      <path d="M30 62 C 50 68, 80 66, 98 58" stroke={INK} strokeWidth="1.6" strokeDasharray="3 5" />
    </svg>
  );
}

export function Mixer({ className }: P) {
  return (
    <svg viewBox="0 0 100 120" className={cn("doodle-wiggle", className)} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: "0.8s" }}>
      <path d="M30 14 L 70 14 L 74 62 L 26 62 Z" fill="#d8efe9" stroke={INK} strokeWidth="2.8" />
      <path d="M36 8 L 64 8" stroke={INK} strokeWidth="3" />
      <path d="M40 40 L 60 34 M40 34 L 60 40" stroke="#1f8a7a" strokeWidth="2.6" />
      <path d="M20 64 C 20 62, 80 62, 80 64 L 84 104 C 84 108, 16 108, 16 104 Z" fill="#d9572b" stroke={INK} strokeWidth="2.8" />
      <circle cx="50" cy="86" r="7" fill="#fff" stroke={INK} strokeWidth="2.4" />
      <path d="M50 82 L 50 86" stroke={INK} strokeWidth="2.4" />
    </svg>
  );
}

export function SaathiCycle({ className }: P) {
  return (
    <svg viewBox="0 0 170 110" className={cn("doodle-float", className)} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="40" cy="80" r="20" stroke={INK} strokeWidth="2.8" />
      <circle cx="126" cy="80" r="20" stroke={INK} strokeWidth="2.8" />
      <path d="M40 80 L 70 46 L 104 46 L 126 80 M70 46 L 86 80 L 40 80 M86 80 L 104 46" stroke="#1f8a7a" strokeWidth="3" />
      <path d="M100 38 L 112 38" stroke={INK} strokeWidth="3" />
      <rect x="96" y="20" width="30" height="20" rx="4" fill="#f4a62a" stroke={INK} strokeWidth="2.4" />
      <path d="M104 26 L 118 26" stroke={INK} strokeWidth="2" />
      <circle cx="74" cy="14" r="8" fill="#ffd7a8" stroke={INK} strokeWidth="2.4" />
      <path d="M74 22 L 78 44 M76 30 L 96 34" stroke={INK} strokeWidth="3" />
      <path d="M8 96 C 30 92, 60 98, 84 94" stroke="#ecdcc6" strokeWidth="3" />
    </svg>
  );
}

export function Wrench({ className }: P) {
  return (
    <svg viewBox="0 0 100 100" className={cn("doodle-wiggle", className)} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: "0.4s" }}>
      <path d="M62 14 C 74 10, 88 22, 84 36 L 74 32 L 66 40 L 70 50 C 56 54, 44 42, 48 28 L 18 58 C 12 64, 20 76, 28 70 L 58 40" fill="#d8efe9" stroke={INK} strokeWidth="2.8" />
      <circle cx="24" cy="66" r="3" fill={INK} />
    </svg>
  );
}

export function Sparkle({ className, color = "#f4a62a" }: P & { color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("doodle-wiggle", className)} fill={color} stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M20 3 C 22 14, 26 18, 37 20 C 26 22, 22 26, 20 37 C 18 26, 14 22, 3 20 C 14 18, 18 14, 20 3 Z" />
    </svg>
  );
}

export function HomeHeart({ className }: P) {
  return (
    <svg viewBox="0 0 110 100" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 46 L 55 14 L 94 46" stroke={INK} strokeWidth="3" />
      <path d="M26 40 L 26 86 L 84 86 L 84 40" fill="#fff3e2" stroke={INK} strokeWidth="2.8" />
      <path d="M55 74 C 40 64, 40 50, 50 50 C 54 50, 55 54, 55 56 C 55 54, 56 50, 60 50 C 70 50, 70 64, 55 74 Z" fill="#d9572b" stroke={INK} strokeWidth="2.2" />
    </svg>
  );
}

/** Small decorative squiggle underline for headings. */
export function Squiggle({ className }: P) {
  return (
    <svg viewBox="0 0 120 12" className={className} fill="none">
      <path className="doodle-draw" style={{ ["--len" as string]: "140" }} strokeDasharray="140" d="M2 8 C 20 2, 30 12, 48 6 C 66 0, 76 12, 94 6 C 104 3, 112 6, 118 5" stroke="#f4a62a" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
