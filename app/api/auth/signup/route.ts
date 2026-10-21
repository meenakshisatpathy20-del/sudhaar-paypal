import { NextResponse } from "next/server";
import { publicAccount, sessionCookie, signUpCustomer } from "@/lib/auth";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const account = await signUpCustomer(req, (await req.json()) as Record<string, unknown>);
    const res = NextResponse.json({ account: publicAccount(account) }, { status: 201 });
    res.headers.set("Set-Cookie", sessionCookie(account));
    return res;
  } catch (e) {
    return fail(e);
  }
}
