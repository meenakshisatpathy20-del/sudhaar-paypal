import { resetDB } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

// Admin only: clears orders and test data (accounts and onboarded karigars are kept). Handy before recording a demo.
export function POST(req: Request) {
  try {
    requireRole(req, "admin");
    resetDB();
    return ok({ reset: true });
  } catch (e) {
    return fail(e);
  }
}
