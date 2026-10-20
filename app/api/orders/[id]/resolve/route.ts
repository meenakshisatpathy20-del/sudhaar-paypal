import { fail, ok } from "@/lib/http";
import { resolveComplaint } from "@/lib/orders";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await req.json()) as { complaintId: string; action: "refund" | "re_repair" | "rejected"; amount?: number };
    return ok({ order: await resolveComplaint((await params).id, body.complaintId, { action: body.action, amount: body.amount }) });
  } catch (e) {
    return fail(e);
  }
}
