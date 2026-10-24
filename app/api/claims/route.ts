import { requireRole } from "@/lib/auth";
import { claimReport, listClaims } from "@/lib/claims";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// Resolve Hub list: customers see their claims, karigars the claims on their repairs, admins all.
export function GET(req: Request) {
  try {
    const a = requireRole(req, "customer", "karigar", "admin");
    const claims = listClaims(a);
    return ok({ claims, report: a.role === "admin" ? claimReport(claims) : undefined });
  } catch (e) {
    return fail(e);
  }
}
