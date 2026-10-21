import { publicAccount, requireRole } from "@/lib/auth";
import { updateDB } from "@/lib/db";
import { validLatLng } from "@/lib/geo";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";

// Customer shares their current location (and optionally edits the pickup address).
export async function POST(req: Request) {
  try {
    const me = requireRole(req, "customer");
    const { lat, lng, address } = (await req.json()) as { lat?: number; lng?: number; address?: string };
    if (!validLatLng(lat, lng)) throw new FlowError("That location doesn't look right");
    const account = await updateDB((db) => {
      const a = db.accounts.find((x) => x.id === me.id)!;
      a.lat = lat;
      a.lng = lng;
      if (typeof address === "string" && address.trim()) a.address = address.trim().slice(0, 120);
      return a;
    });
    return ok({ account: publicAccount(account) });
  } catch (e) {
    return fail(e);
  }
}
