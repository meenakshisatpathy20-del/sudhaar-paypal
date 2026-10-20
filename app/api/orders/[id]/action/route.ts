import { fail, ok } from "@/lib/http";
import { advance, type Action } from "@/lib/orders";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await req.json()) as { action: Action; otp?: string; afterPhoto?: string };
    return ok({ order: await advance((await params).id, body.action, { otp: body.otp, afterPhoto: body.afterPhoto }) });
  } catch (e) {
    return fail(e);
  }
}
