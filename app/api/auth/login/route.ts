import { NextResponse } from "next/server";
import { login, publicAccount, sessionCookie } from "@/lib/auth";
import { fail } from "@/lib/http";

// Customers log in on /login; karigars, Saathis and admins on /partner (area "partner").
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string; pin?: string; area?: "customer" | "partner" };
    const account = login(req, body, body.area === "partner" ? ["karigar", "saathi", "admin"] : ["customer"]);
    const res = NextResponse.json({ account: publicAccount(account) });
    res.headers.set("Set-Cookie", sessionCookie(account));
    return res;
  } catch (e) {
    return fail(e);
  }
}
