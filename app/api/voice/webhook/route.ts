import { fail, ok } from "@/lib/http";
import { logCall, requireVoiceToken } from "@/lib/voice";

export const dynamic = "force-dynamic";

// Bolna's post-call webhook (status, duration, transcript, summary) → the admin console's Phone line tab.
export async function POST(req: Request) {
  try {
    requireVoiceToken(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const call = await logCall(body);
    return ok({ received: true, id: call.id });
  } catch (e) {
    return fail(e);
  }
}
