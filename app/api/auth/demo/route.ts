import { NextResponse } from "next/server";
import { publicAccount, sessionCookie } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";

// One-tap demo logins for judges: the shared demo customer, a sample karigar, a Saathi or the admin.
const DEMO_IDS = { customer: "C-DEMO", karigar: "K-k-mohan", saathi: "S-s-vikas", admin: "A-ADMIN" } as const;

export async function POST(req: Request) {
  try {
    rateLimit(req, "demo-login", 60);
    const { role = "customer" } = (await req.json().catch(() => ({}))) as { role?: keyof typeof DEMO_IDS };
    const account = readDB().accounts.find((a) => a.id === DEMO_IDS[role]);
    if (!account) throw new FlowError("Demo account not found", 404);
    const res = NextResponse.json({ account: publicAccount(account) });
    res.headers.set("Set-Cookie", sessionCookie(account));
    return res;
  } catch (e) {
    return fail(e);
  }
}
