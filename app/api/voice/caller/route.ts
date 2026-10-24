import { fail, ok } from "@/lib/http";
import { callerContext, requireVoiceToken, voiceInput } from "@/lib/voice";

export const dynamic = "force-dynamic";

// Bolna inbound caller lookup: GET ?contact_number=+91…  → facts added to the agent's prompt.
// Only a first name and repair statuses: nothing that would help someone who fakes a caller ID.
export async function GET(req: Request) {
  try {
    requireVoiceToken(req);
    const q = await voiceInput(req);
    return ok(callerContext(q.contact_number ?? q.from_number ?? q.phone));
  } catch (e) {
    return fail(e);
  }
}
