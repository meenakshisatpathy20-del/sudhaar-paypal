import type { PickupSlot } from "./types";

// Pickup (or home-visit) windows in Indian time. Shared by the browser, which offers them, and the
// server, which only accepts a window that really is coming up.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WINDOWS: [number, number][] = [
  [10, 12],
  [13, 15],
  [17, 19],
];
/** A Saathi needs at least this long to get there. */
const LEAD_MS = 60 * 60 * 1000;

/** The next `count` windows starting at least an hour from `now`. */
export function pickupSlots(now = Date.now(), count = 5): PickupSlot[] {
  const ist = new Date(now + IST_OFFSET_MS);
  const out: PickupSlot[] = [];
  for (let day = 0; day < 4 && out.length < count; day++) {
    for (const [from, to] of WINDOWS) {
      const start = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + day, from) - IST_OFFSET_MS;
      if (start < now + LEAD_MS) continue;
      out.push({ start: new Date(start).toISOString(), end: new Date(start + (to - from) * 60 * 60 * 1000).toISOString() });
      if (out.length === count) break;
    }
  }
  return out;
}

/** The slot the customer picked, if it is still on offer (allowing for time spent on the page). */
export function acceptSlot(slot: unknown, now = Date.now()): PickupSlot | null {
  const start = (slot as PickupSlot | undefined)?.start;
  if (typeof start !== "string") return null;
  return pickupSlots(now - LEAD_MS / 2, 8).find((s) => s.start === start) ?? null;
}

/** "Today, 5–7 pm" in the app's language, always in Indian time. */
export function slotLabel(slot: PickupSlot, locale: string, words: { today: string; tomorrow: string }, now = Date.now()): string {
  const tz = "Asia/Kolkata";
  const dayKey = (t: number) => new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
  const start = Date.parse(slot.start);
  const diff = Math.round((Date.parse(dayKey(start)) - Date.parse(dayKey(now))) / 86400000);
  const day = diff === 0 ? words.today : diff === 1 ? words.tomorrow : new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(start);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: tz });
  return `${day}, ${time.formatRange(start, Date.parse(slot.end))}`;
}
