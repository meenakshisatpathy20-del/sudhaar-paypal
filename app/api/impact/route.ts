import { ok } from "@/lib/http";
import { impactStats } from "@/lib/orders";

export const dynamic = "force-dynamic";

// Public impact numbers for the home and profile pages (totals only, no personal data).
export function GET() {
  return ok({ impact: impactStats() });
}
