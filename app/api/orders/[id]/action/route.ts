import { fail, ok } from "@/lib/http";
import { advance, type Action } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "action", 120);
    const body = (await req.json()) as { action: Action; otp?: string; afterPhoto?: string; jobId?: string };
    return ok({ order: await advance((await params).id, body.action, { otp: body.otp, afterPhoto: body.afterPhoto, jobId: body.jobId }) });
  } catch (e) {
    return fail(e);
  }
}
