import { requireRole } from "@/lib/auth";
import { updateDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { INR_PER_USD, round2 } from "@/lib/pricing";
import type { SaathiVehicle } from "@/lib/types";

// Partners edit their own profile. Karigars: bio, usual turnaround and their rate card (prices in
// rupees on screen, stored in USD like every price). Saathis: area and vehicle (used for the ETA).
// Note: sample karigars and Saathis are re-read from the seed on every server start.
const VEHICLES: SaathiVehicle[] = ["walk", "bicycle", "scooter", "motorbike"];

export async function POST(req: Request) {
  try {
    const account = requireRole(req, "karigar", "saathi");
    const body = (await req.json().catch(() => ({}))) as { bio?: string; turnaroundDays?: number; services?: { name: string; priceInr: number }[]; area?: string; vehicle?: string };
    const profile = await updateDB((db) => {
      if (account.role === "karigar") {
        const k = db.karigars.find((x) => x.id === account.karigarId);
        if (!k) throw new FlowError("Profile not found", 404);
        if (typeof body.bio === "string") k.bio = body.bio.trim().slice(0, 240) || k.bio;
        if (body.turnaroundDays !== undefined) {
          const d = Math.round(Number(body.turnaroundDays));
          if (!(d >= 0 && d <= 14)) throw new FlowError("Turnaround must be 0 to 14 days");
          k.turnaroundDays = d;
        }
        if (Array.isArray(body.services)) {
          const services = body.services
            .slice(0, 8)
            .map((s) => ({ name: String(s.name ?? "").trim().slice(0, 40), price: round2(Number(s.priceInr) / INR_PER_USD) }))
            .filter((s) => s.name && s.price > 0);
          if (services.some((s) => s.price * INR_PER_USD > 10000)) throw new FlowError("Keep each price under ₹10,000");
          k.services = services;
        }
        return { bio: k.bio, turnaroundDays: k.turnaroundDays, services: k.services };
      }
      const s = db.saathis.find((x) => x.id === account.saathiId);
      if (!s) throw new FlowError("Profile not found", 404);
      if (typeof body.area === "string") s.area = body.area.trim().slice(0, 40);
      if (body.vehicle !== undefined) {
        if (!VEHICLES.includes(body.vehicle as SaathiVehicle)) throw new FlowError("Pick walk, bicycle, scooter or motorbike");
        s.vehicle = body.vehicle as SaathiVehicle;
      }
      return { area: s.area, vehicle: s.vehicle };
    });
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}
