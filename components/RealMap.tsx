"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MapProps, Pin } from "./NeighbourhoodMap";

type LatLng = { lat: number; lng: number };

// Real OpenStreetMap map (no API key), drawn with plain Leaflet. Leaflet needs the browser, so
// NeighbourhoodMap loads this on the client only. OSM's public tiles are fine for a demo; a launch
// would use a paid tile provider.

const pinIcon = (color: string, letter: string, active: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    tooltipAnchor: [0, 2],
    html: `<svg width="28" height="36" viewBox="-14 -34 28 36" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,.25))"><path d="M0 0 C -8 -10 -12 -15 -12 -21 A 12 12 0 1 1 12 -21 C 12 -15 8 -10 0 0 Z" fill="${color}" stroke="#fff" stroke-width="${active ? 2.5 : 1.5}"/><text y="-17" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">${letter}</text></svg>`,
  });

const homeIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<svg width="28" height="28" viewBox="-14 -14 28 28"><circle r="12" fill="#d9572b" stroke="#fff" stroke-width="3"/><path d="M -5 1 L 0 -4 L 5 1 L 5 5 L -5 5 Z" fill="#fff"/></svg>`,
});

const saathiIcon = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<svg width="24" height="24" viewBox="-12 -12 24 24"><circle r="11" fill="#1f8a7a" opacity=".25"/><circle r="6.5" fill="#1f8a7a" stroke="#fff" stroke-width="2"/></svg>`,
});

/** The Saathi's live GPS position: a pulsing dot. */
const liveIcon = L.divIcon({
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<svg width="34" height="34" viewBox="-17 -17 34 34"><circle r="15" fill="#1f8a7a" opacity=".22"><animate attributeName="r" values="9;16;9" dur="1.8s" repeatCount="indefinite"/></circle><circle r="8" fill="#1f8a7a" stroke="#fff" stroke-width="2.5"/><path d="M-3 2 L0 -4 L3 2 Z" fill="#fff"/></svg>`,
});

/** The point at fraction f (0..1) along a path, by distance. */
function along(points: LatLng[], f: number): LatLng {
  const legs = points.slice(1).map((b, i) => Math.hypot(b.lat - points[i].lat, b.lng - points[i].lng));
  let left = f * legs.reduce((a, l) => a + l, 0);
  for (const [i, len] of legs.entries()) {
    if (left <= len) {
      const k = len ? left / len : 0;
      return { lat: points[i].lat + (points[i + 1].lat - points[i].lat) * k, lng: points[i].lng + (points[i + 1].lng - points[i].lng) * k };
    }
    left -= len;
  }
  return points[points.length - 1];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const safeColor = (c?: string) => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : "#d9572b");

export default function RealMap({ center, pins, selected, route, onSelect, saathiProgress, saathiAt, path: customPath, hideHome }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef("");
  const fit = useRef<() => void>(() => {});
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  });

  // Create the map once.
  useEffect(() => {
    // Quarter-step zoom so the neighbourhood fills a small phone-sized map instead of snapping far out.
    const m = L.map(el.current!, { scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.5 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    // The box often gets its final size after Leaflet starts (lazy load, aspect-ratio layout):
    // re-measure and re-fit whenever it changes, or the pins end up bunched or off-screen.
    const resized = new ResizeObserver(() => {
      m.invalidateSize();
      fit.current();
    });
    resized.observe(el.current!);
    return () => {
      resized.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
      fitted.current = "";
    };
  }, []);

  // Draw home, pins, route and the Saathi whenever they change.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();

    const stops = (route ?? (selected ? [selected] : [])).map((id) => pins.find((p) => p.id === id)).filter((p): p is Pin => Boolean(p));
    const path = customPath ?? (stops.length ? [center, ...stops, center] : []);
    const onRoute = new Set(stops.map((p) => p.id));
    if (path.length) L.polyline(path, { color: "#d9572b", weight: 3, dashArray: "6 8", opacity: 0.85, interactive: false }).addTo(g);

    const clickable = Boolean(onSelect);
    for (const p of pins) {
      const active = p.id === selected || onRoute.has(p.id);
      const marker = L.marker(p, { icon: pinIcon(safeColor(p.color), escapeHtml(p.name[0] ?? "K"), active), title: p.name, interactive: clickable || Boolean(p.label), keyboard: clickable }).addTo(g);
      if (clickable) marker.on("click", () => select.current?.(p.id));
      if (active || p.label) marker.bindTooltip(escapeHtml(p.label ?? p.name), { direction: "bottom", permanent: active, className: "sudhaar-map-tip" });
    }
    if (!hideHome) L.marker(center, { icon: homeIcon, zIndexOffset: 500, interactive: false }).addTo(g);

    if (saathiAt) {
      const live = L.marker(saathiAt, { icon: liveIcon, zIndexOffset: 1000, interactive: Boolean(saathiAt.label) }).addTo(g);
      if (saathiAt.label) live.bindTooltip(escapeHtml(saathiAt.label), { direction: "top", permanent: true, className: "sudhaar-map-tip" });
    } else if (path.length && saathiProgress !== undefined) {
      // Progress 0..0.5 runs from home through every karigar stop; 0.5..1 is the ride back home.
      const f = Math.min(1, Math.max(0, saathiProgress));
      const at = f <= 0.5 ? along(path.slice(0, -1), f * 2) : along(path.slice(-2), f * 2 - 1);
      L.marker(at, { icon: saathiIcon, zIndexOffset: 1000, interactive: false }).addTo(g);
    }

    // Refit only when the set of points changes, so selecting a pin doesn't jump the map.
    const points = [...(hideHome ? [] : [center]), ...pins, ...(saathiAt ? [saathiAt] : [])];
    if (!points.length) points.push(center);
    const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
    // Pins are drawn above their point and the zoom buttons sit top-left, so leave more room there.
    fit.current = () => {
      if (points.length === 1) m.setView(points[0], 15);
      else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { paddingTopLeft: [52, 44], paddingBottomRight: [24, 20], maxZoom: 16 });
    };
    if (key !== fitted.current) {
      fitted.current = key;
      m.invalidateSize();
      fit.current();
    }
  }, [center, pins, selected, route, saathiProgress, onSelect, saathiAt, customPath, hideHome]);

  return <div ref={el} className="h-full w-full" style={{ background: "#f6ead6" }} />;
}
