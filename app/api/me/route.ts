import { currentAccount, publicAccount } from "@/lib/auth";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const account = currentAccount(req);
  return ok({ account: account ? publicAccount(account) : null });
}
