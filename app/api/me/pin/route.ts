import { requireRole, validPin } from "@/lib/auth";
import { updateDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { hashPin, pinMatches } from "@/lib/pin";
import { rateLimit } from "@/lib/ratelimit";

// Change your own PIN (needs the current one). Shared demo logins keep the PIN listed for judges.
export async function POST(req: Request) {
  try {
    rateLimit(req, "pin", 10);
    const me = requireRole(req, "customer", "karigar", "saathi", "admin");
    const { current, next } = (await req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
    if (me.demo) throw new FlowError("Demo logins are shared, so their PIN can't be changed.");
    if (!validPin(current) || !pinMatches(current, me.pinHash)) throw new FlowError("Your current PIN is not right.");
    if (!validPin(next)) throw new FlowError("Choose a new 4-digit PIN.");
    if (next === current) throw new FlowError("The new PIN is the same as the old one.");
    if (/^(\d)\1{3}$/.test(next) || ["1234", "4321", "0000"].includes(next)) throw new FlowError("Pick a PIN that's harder to guess.");
    await updateDB((db) => {
      const a = db.accounts.find((x) => x.id === me.id)!;
      a.pinHash = hashPin(next);
    });
    return ok({ changed: true });
  } catch (e) {
    return fail(e);
  }
}
