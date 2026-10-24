import { requireRole } from "@/lib/auth";
import { actOnClaim, getClaim, type ClaimAction } from "@/lib/claims";
import { fail, ok } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = requireRole(req, "customer", "karigar", "admin");
    return ok(getClaim(a, (await params).id));
  } catch (e) {
    return fail(e);
  }
}

// One endpoint for every claim action: comment, evidence, withdraw, and the team's status / assign / priority / decide / reopen.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "claim", 60);
    const a = requireRole(req, "customer", "karigar", "admin");
    const body = (await req.json().catch(() => ({}))) as ClaimAction;
    return ok(await actOnClaim(a, (await params).id, body));
  } catch (e) {
    return fail(e);
  }
}
