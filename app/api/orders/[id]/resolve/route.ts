import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { resolveComplaint } from "@/lib/orders";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireRole(req, "admin");
    const body = (await req.json()) as { complaintId: string; action: "refund" | "re_repair" | "rejected"; amount?: number; remarks?: string };
    return ok({ order: await resolveComplaint((await params).id, body.complaintId, { action: body.action, amount: body.amount, remarks: typeof body.remarks === "string" ? body.remarks.slice(0, 500) : undefined, by: admin }) });
  } catch (e) {
    return fail(e);
  }
}
