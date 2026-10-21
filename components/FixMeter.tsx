"use client";

import { useLang } from "./LanguageProvider";

/**
 * Fix-or-Replace meter: how much of the price of a new item the repair saves.
 * 100% = repair is almost free compared to buying new.
 */
export function FixMeter({ repairMid, newPrice }: { repairMid: number; newPrice: number }) {
  const { t } = useLang();
  const score = newPrice > 0 ? Math.max(0, Math.min(1, 1 - repairMid / newPrice)) : 0.85;
  const angle = -90 + score * 180;
  const label = score >= 0.75 ? t("verdictRepair") : score >= 0.5 ? t("verdictWorth") : score >= 0.3 ? t("verdictBorder") : t("verdictReplace");
  const color = score >= 0.5 ? "#2dd4bf" : score >= 0.3 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[240px]" aria-label={`${t("verdict")}: ${label}`}>
        <defs>
          <linearGradient id="meter" x1="0" x2="1">
            <stop offset="0" stopColor="#f87171" />
            <stop offset="0.45" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ffffff14" strokeWidth="14" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#meter)" strokeWidth="14" strokeLinecap="round" strokeDasharray="251.3" strokeDashoffset={251.3 * (1 - score)} style={{ transition: "stroke-dashoffset 1s ease" }} />
        <g transform={`rotate(${angle} 100 100)`} style={{ transition: "transform 1s ease" }}>
          <line x1="100" y1="100" x2="100" y2="34" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill={color} />
        <text x="100" y="80" textAnchor="middle" className="fill-foreground font-display" fontSize="22" fontWeight="700">
          {Math.round(score * 100)}%
        </text>
      </svg>
      <p className="-mt-1 text-sm font-semibold" style={{ color }}>
        {label}
      </p>
      <p className="text-[11px] text-muted-foreground">{t("verdict")}</p>
    </div>
  );
}
