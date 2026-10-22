import { NextResponse } from "next/server";
import { publicAccount, sessionCookie } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
import type { DB, OrderStatus } from "@/lib/types";

// One-tap demo logins for judges: the shared demo customer, a sample karigar, a Saathi or the admin.
const DEMO_IDS = { customer: "C-DEMO", karigar: "K-k-mohan", saathi: "S-s-vikas", admin: "A-ADMIN" } as const;

// A judge who just booked should land in the app that has their job: the karigar and Saathi of the
// most recent order still waiting on them (sample partners only, since those have demo logins).
const SAATHI_TURN: OrderStatus[] = ["authorized", "picked_up", "at_karigar", "repaired", "out_for_delivery"];
const KARIGAR_TURN: OrderStatus[] = ["authorized", "picked_up", "at_karigar", "repairing", "repaired"];

function partnerWithWork(db: DB, role: "karigar" | "saathi"): string | null {
  const recent = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const o of recent) {
    if (role === "saathi") {
      if (o.mode === "pickup" && SAATHI_TURN.includes(o.status)) return `S-${o.saathiId}`;
    } else if (KARIGAR_TURN.includes(o.status)) {
      const pending = o.jobs?.find((j) => j.status !== "repaired");
      return `K-${pending?.karigarId ?? o.karigarId}`;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    rateLimit(req, "demo-login", 60);
    const { role = "customer" } = (await req.json().catch(() => ({}))) as { role?: keyof typeof DEMO_IDS };
    const db = readDB();
    const wanted = role === "karigar" || role === "saathi" ? partnerWithWork(db, role) : null;
    const account = (wanted && db.accounts.find((a) => a.id === wanted && a.demo)) || db.accounts.find((a) => a.id === DEMO_IDS[role]);
    if (!account) throw new FlowError("Demo account not found", 404);
    const res = NextResponse.json({ account: publicAccount(account) });
    res.headers.set("Set-Cookie", sessionCookie(account));
    return res;
  } catch (e) {
    return fail(e);
  }
}
