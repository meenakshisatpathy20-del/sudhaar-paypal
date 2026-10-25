import { requireRole } from "@/lib/auth";
import { placeCall } from "@/lib/bolna";
import { updateDB } from "@/lib/db";
import { callerContext } from "@/lib/voice";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";

// "Ask Sudhaar to call me": the Bolna Hindi agent phones the logged-in customer on their own number.
// One call every 10 minutes per account, so nobody can use it to ring a phone repeatedly.
const last = new Map<string, number>();

export async function POST(req: Request) {
  try {
    rateLimit(req, "voice-callback", 5);
    const me = requireRole(req, "customer");
    if (me.demo) throw new FlowError("The shared demo account can't receive calls. Sign up with your own number to try it.");
    const since = Date.now() - (last.get(me.id) ?? 0);
    if (since < 10 * 60 * 1000) throw new FlowError(`We called you a moment ago. Try again in ${Math.ceil((10 * 60 * 1000 - since) / 60000)} min.`, 429);
    const ctx = callerContext(me.phone);
    const call = await placeCall(me.phone, { ...Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, String(v)])), call_reason: "callback_from_website", from_number: `+91${me.phone}`, customer_name: me.name.split(" ")[0] });
    last.set(me.id, Date.now());
    await updateDB((db) => {
      db.voiceCalls ??= [];
      db.voiceCalls.unshift({ id: call.callId ?? `out-${Date.now().toString(36)}`, at: new Date().toISOString(), direction: "outbound", to: me.phone, reason: "callback_from_website", status: call.status ?? "queued", customerId: me.id });
    });
    return ok({ calling: true, callId: call.callId ?? null });
  } catch (e) {
    return fail(e);
  }
}
