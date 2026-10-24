import { currentAccount, publicAccount, requireRole } from "@/lib/auth";
import { updateDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const account = currentAccount(req);
  return ok({ account: account ? publicAccount(account) : null });
}

// Customers edit their name and pickup address. The shared demo account keeps its name.
export async function POST(req: Request) {
  try {
    const me = requireRole(req, "customer");
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; address?: unknown };
    const account = await updateDB((db) => {
      const a = db.accounts.find((x) => x.id === me.id)!;
      if (typeof body.name === "string") {
        const name = body.name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60);
        if (name.length < 2) throw new FlowError("Please enter your name");
        if (a.demo && name !== a.name) throw new FlowError("The shared demo account's name can't be changed. Sign up to have your own.");
        a.name = name;
      }
      if (typeof body.address === "string" && body.address.trim()) a.address = body.address.trim().slice(0, 120);
      return a;
    });
    return ok({ account: publicAccount(account) });
  } catch (e) {
    return fail(e);
  }
}
