import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { tick, timings } from "@/lib/symphony";

export const dynamic = "force-dynamic";

// Admin: run the conductor now (reminders, expiry notices, pickup reminder calls) instead of waiting a minute.
export async function POST(req: Request) {
  try {
    requireRole(req, "admin");
    return ok({ ...(await tick()), timings: timings() });
  } catch (e) {
    return fail(e);
  }
}
