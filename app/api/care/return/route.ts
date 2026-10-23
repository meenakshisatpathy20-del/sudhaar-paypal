import { currentAccount } from "@/lib/auth";
import { confirmCare, originOf } from "@/lib/care";

export const dynamic = "force-dynamic";

// PayPal sends the customer here after they approve the subscription (?subscription_id=…).
// We never trust the query string alone: the status comes from PayPal's Subscriptions API.
export async function GET(req: Request) {
  const origin = originOf(req);
  const account = currentAccount(req);
  if (!account) return Response.redirect(`${origin}/login?next=/care`, 302);
  const id = new URL(req.url).searchParams.get("subscription_id") ?? "";
  try {
    const care = await confirmCare(account, id);
    return Response.redirect(`${origin}/care?status=${care.status === "ACTIVE" ? "active" : "pending"}`, 302);
  } catch (e) {
    return Response.redirect(`${origin}/care?status=error&msg=${encodeURIComponent((e as Error).message.slice(0, 160))}`, 302);
  }
}
