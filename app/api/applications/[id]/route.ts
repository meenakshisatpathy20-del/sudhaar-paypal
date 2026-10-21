import { fail, ok } from "@/lib/http";
import { type CheckKey, decide, setCheck } from "@/lib/onboarding";

// Admin console: tick KYC checks, then approve or reject an application.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { action: "check"; check: CheckKey; value: boolean } | { action: "approve" | "reject" };
    const application = body.action === "check" ? await setCheck(id, body.check, Boolean(body.value)) : await decide(id, body.action === "approve");
    return ok({ application });
  } catch (e) {
    return fail(e);
  }
}
