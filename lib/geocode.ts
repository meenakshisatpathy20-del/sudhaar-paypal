// The spoken address from a phone booking → a point on the map, with OpenStreetMap's Nominatim
// (free, no key; one request per booking is well within its usage policy). If it can't be found,
// the caller keeps the service-area centre and the Saathi uses the address text and a call.

const base = () => (process.env.GEOCODE_BASE ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = address.trim();
  if (q.length < 6) return null;
  try {
    const url = `${base()}/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Sudhaar/1.0 (doorstep repair prototype)", "Accept-Language": "en" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const h = hits[0];
    if (!h) return null;
    const lat = Number(h.lat), lng = Number(h.lon);
    // Inside India's bounding box, or it's not the place they meant.
    if (!(lat > 6 && lat < 37.5 && lng > 68 && lng < 97.5)) return null;
    return { lat, lng, label: h.display_name.slice(0, 160) };
  } catch {
    return null;
  }
}
