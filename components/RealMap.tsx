"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { MapProps, Pin } from "./NeighbourhoodMap";

type LatLng = { lat: number; lng: number };

// Real OpenStreetMap map (no API key). Leaflet needs the browser, so NeighbourhoodMap loads this
// on the client only. OSM's public tiles are fine for a demo; a launch would use a tile provider.

const pinIcon = (color: string, letter: string, active: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 34],
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

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 16 });
    // Refit only when the points change, not on every render.
  }, [key, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function RealMap({ center, pins, selected, route, onSelect, saathiProgress }: MapProps) {
  const stops = useMemo(() => (route ?? (selected ? [selected] : [])).map((id) => pins.find((p) => p.id === id)).filter((p): p is Pin => Boolean(p)), [route, selected, pins]);
  const path = stops.length ? [center, ...stops, center] : [];
  const onRoute = new Set(stops.map((p) => p.id));
  // Progress 0..0.5 runs from home through every karigar stop; 0.5..1 is the ride back home.
  let saathi: LatLng | null = null;
  if (path.length && saathiProgress !== undefined) {
    const p = Math.min(1, Math.max(0, saathiProgress));
    saathi = p <= 0.5 ? along(path.slice(0, -1), p * 2) : along(path.slice(-2), p * 2 - 1);
  }
  return (
    <MapContainer center={center} zoom={14} scrollWheelZoom={false} className="h-full w-full" style={{ background: "#f6ead6" }} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <FitBounds points={[center, ...pins]} />
      {path.length > 0 && <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#d9572b", weight: 3, dashArray: "6 8", opacity: 0.85 }} />}
      {pins.map((p) => {
        const active = p.id === selected || onRoute.has(p.id);
        return (
          <Marker key={p.id} position={p} icon={pinIcon(p.color ?? "#d9572b", p.name[0] ?? "K", active)} eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}>
            {(active || p.label) && (
              <Tooltip direction="bottom" offset={[0, 2]} permanent={active} className="!rounded-lg !border-0 !px-1.5 !py-0.5 !text-[10px] !font-semibold !shadow">
                {p.label ?? p.name}
              </Tooltip>
            )}
          </Marker>
        );
      })}
      <Marker position={center} icon={homeIcon} zIndexOffset={500} />
      {saathi && <Marker position={saathi} icon={saathiIcon} zIndexOffset={1000} />}
    </MapContainer>
  );
}
