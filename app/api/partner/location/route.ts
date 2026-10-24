import { requireRole } from "@/lib/auth";
import { updateDB } from "@/lib/db";
import { validLatLng } from "@/lib/geo";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";

// The Saathi app sends its position while the Saathi shares their location (or runs the labelled
// demo ride). Customers see it on their order page and tracking link while their item is on the road.
export async function POST(req: Request) {
  try {
    const account = requireRole(req, "saathi");
    const body = (await req.json().catch(() => ({}))) as { lat?: unknown; lng?: unknown; simulated?: unknown; stop?: unknown };
    const sid = account.saathiId!;
    if (body.stop === true) {
      await updateDB((db) => {
        if (db.saathiLocations) delete db.saathiLocations[sid];
      });
      return ok({ sharing: false });
    }
    if (!validLatLng(body.lat, body.lng)) throw new FlowError("Invalid location");
    const loc = { lat: body.lat as number, lng: body.lng as number, at: new Date().toISOString(), simulated: body.simulated === true || undefined };
    await updateDB((db) => {
      db.saathiLocations ??= {};
      db.saathiLocations[sid] = loc;
    });
    return ok({ sharing: true, at: loc.at });
  } catch (e) {
    return fail(e);
  }
}
