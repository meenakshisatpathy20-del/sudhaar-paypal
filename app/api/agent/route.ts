import { agentTurn } from "@/lib/agent";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    rateLimit(req, "agent", 25);
    const body = (await req.json()) as { sessionId?: string; message?: string; photo?: string; lang?: "en" | "hi" };
    if (!body.message?.trim()) throw new FlowError("Say what you need fixed");
    return ok(await agentTurn({ sessionId: body.sessionId, message: body.message.slice(0, 2000), photo: body.photo, lang: body.lang === "hi" ? "hi" : "en" }));
  } catch (e) {
    return fail(e);
  }
}
