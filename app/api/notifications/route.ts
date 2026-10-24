import { requireRole } from "@/lib/auth";
import { markRead, notificationsFor } from "@/lib/claims";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  try {
    return ok(notificationsFor(requireRole(req, "customer", "karigar", "saathi", "admin")));
  } catch (e) {
    return fail(e);
  }
}

/** Mark notifications read: { ids } for some, or nothing for all. */
export async function POST(req: Request) {
  try {
    const a = requireRole(req, "customer", "karigar", "saathi", "admin");
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    await markRead(a, Array.isArray(body.ids) ? body.ids.map(String) : undefined);
    return ok(notificationsFor(a));
  } catch (e) {
    return fail(e);
  }
}
