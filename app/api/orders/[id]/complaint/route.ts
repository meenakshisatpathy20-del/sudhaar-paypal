import { fail, ok } from "@/lib/http";
import { FlowError, raiseComplaint } from "@/lib/orders";
import type { Complaint } from "@/lib/types";

const ISSUES: Complaint["issue"][] = ["repair_failed", "damaged", "overcharged", "delayed", "missing"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await req.json()) as { issue: Complaint["issue"]; details: string; photo?: string };
    if (!ISSUES.includes(body.issue)) throw new FlowError("Pick what went wrong");
    if (!body.details?.trim()) throw new FlowError("Tell us what happened");
    return ok({ order: await raiseComplaint((await params).id, { issue: body.issue, details: body.details.slice(0, 1000), photo: body.photo }) });
  } catch (e) {
    return fail(e);
  }
}
