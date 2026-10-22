import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { FlowError, getOrder, raiseComplaint } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";
import { rateLimit } from "@/lib/ratelimit";
import type { Complaint } from "@/lib/types";

const ISSUES: Complaint["issue"][] = ["repair_failed", "damaged", "overcharged", "delayed", "missing"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "complaint", 15);
    const customer = requireRole(req, "customer");
    const { id } = await params;
    assertCanView(customer, getOrder(id));
    const body = (await req.json()) as { issue: Complaint["issue"]; details: string; photo?: string };
    if (!ISSUES.includes(body.issue)) throw new FlowError("Pick what went wrong");
    if (!body.details?.trim()) throw new FlowError("Tell us what happened");
    return ok({ order: orderFor(customer, await raiseComplaint(id, { issue: body.issue, details: body.details.slice(0, 1000), photo: body.photo })) });
  } catch (e) {
    return fail(e);
  }
}
