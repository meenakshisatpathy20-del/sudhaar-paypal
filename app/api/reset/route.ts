import { resetDB } from "@/lib/db";
import { ok } from "@/lib/http";

// Restores the seeded demo data (karigars, saathis) and clears orders. Handy before recording a demo.
export function POST() {
  resetDB();
  return ok({ reset: true });
}
