import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { reviewCompletion } from "@/lib/orders";

// Admin console: a person approves or rejects a repair photo the AI could not pass.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireRole(req, "admin");
    const body = (await req.json()) as { jobId?: string; approve: boolean };
    return ok({ order: await reviewCompletion((await params).id, { jobId: body.jobId, approve: Boolean(body.approve) }) });
  } catch (e) {
    return fail(e);
  }
}
