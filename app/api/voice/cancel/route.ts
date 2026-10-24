import { fail, ok } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { voiceCancel, requireVoiceToken, voiceInput } from "@/lib/voice";

export const dynamic = "force-dynamic";

// Bolna phone line custom function (see docs/BOLNA.md). Needs VOICE_API_TOKEN.
async function handle(req: Request) {
  try {
    requireVoiceToken(req);
    rateLimit(req, "voice-cancel", 120);
    return ok(await voiceCancel(await voiceInput(req)));
  } catch (e) {
    return fail(e);
  }
}

export const GET = handle;
export const POST = handle;
