import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { listApplications, submitApplication } from "@/lib/onboarding";
import { maskEmail } from "@/lib/privacy";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Admin console list. The demo has no staff login, so phone numbers are masked here;
// production would show full contact details only to signed-in staff.
export function GET(req: Request) {
  try {
    requireRole(req, "admin");
  } catch (e) {
    return fail(e);
  }
  const mask = (phone: string) => `•••••• ${phone.replace(/\D/g, "").slice(-4)}`;
  return ok({ applications: listApplications().map((a) => ({ ...a, phone: mask(a.phone), payoutEmail: a.payoutEmail && maskEmail(a.payoutEmail) })).reverse() });
}

// "Join as a karigar" form submissions.
export async function POST(req: Request) {
  try {
    rateLimit(req, "apply", 10);
    const app = await submitApplication((await req.json()) as Record<string, unknown>);
    return ok({ application: { id: app.id, status: app.status } }, 201);
  } catch (e) {
    return fail(e);
  }
}
