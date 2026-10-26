import { requireRole } from "@/lib/auth";
import { updateDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";

// Admin: mark a callback request done once someone on the team has called the customer back.
export async function POST(req: Request) {
  try {
    const admin = requireRole(req, "admin");
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    const cb = await updateDB((db) => {
      const c = (db.callbacks ?? []).find((x) => x.id === id);
      if (!c) throw new FlowError("Callback request not found", 404);
      c.status = "done";
      c.doneAt = new Date().toISOString();
      c.doneBy = admin.name;
      return c;
    });
    return ok({ callback: cb });
  } catch (e) {
    return fail(e);
  }
}
