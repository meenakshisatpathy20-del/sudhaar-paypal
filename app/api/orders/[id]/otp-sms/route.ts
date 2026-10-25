import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { FlowError, getOrder } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
import { resendOtp } from "@/lib/sms";

// At the door, the customer can't find their OTP: the Saathi (or the karigar on a home visit) has it
// texted again to the customer's registered number. The OTP itself is never shown to the partner.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "otp-sms", 20);
    const a = requireRole(req, "saathi", "karigar", "admin");
    const o = getOrder((await params).id);
    assertCanView(a, o);
    if (a.role === "karigar" && o.mode !== "home-visit") throw new FlowError("The Repair Saathi handles OTPs for pickups.", 403);
    const r = await resendOtp(o.id);
    if (!r.ok) {
      const why = { too_many: "The OTP was already sent 3 times in 30 minutes.", no_otp_now: "This step doesn't need an OTP.", no_phone: "This customer has no mobile number on file." } as const;
      throw new FlowError(why[r.reason as keyof typeof why] ?? "Could not send the OTP.");
    }
    return ok({ sentTo: r.to, status: r.status });
  } catch (e) {
    return fail(e);
  }
}
