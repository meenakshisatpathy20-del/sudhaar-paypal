import { newPin, requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { type CheckKey, decide, setCheck } from "@/lib/onboarding";

// Admin console: tick KYC checks, then approve (creates the karigar's login) or reject.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireRole(req, "admin");
    const { id } = await params;
    const body = (await req.json()) as { action: "check"; check: CheckKey; value: boolean } | { action: "approve" | "reject" };
    const result = body.action === "check" ? await setCheck(id, body.check, Boolean(body.value)) : await decide(id, body.action === "approve", body.action === "approve" ? newPin() : undefined);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
