import { currentAccount, requireRole } from "@/lib/auth";
import { CARE_BENEFITS, originOf, startCare, stopCare } from "@/lib/care";
import { fail, ok } from "@/lib/http";
import { paypalMode } from "@/lib/paypal";
import { CARE_PRICE_USD } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Sudhaar Care: plan details, the customer's membership, subscribe (PayPal approval link) and cancel.
export function GET(req: Request) {
  const a = currentAccount(req);
  return ok({ priceUsd: CARE_PRICE_USD, benefits: CARE_BENEFITS, mode: paypalMode(), membership: a?.role === "customer" ? (a.care ?? null) : null });
}

export async function POST(req: Request) {
  try {
    const account = requireRole(req, "customer");
    const { action } = (await req.json().catch(() => ({}))) as { action?: string };
    if (action === "cancel") return ok({ membership: await stopCare(account) });
    return ok(await startCare(account, originOf(req)));
  } catch (e) {
    return fail(e);
  }
}
