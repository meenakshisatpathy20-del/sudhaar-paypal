"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import { homeFor } from "@/components/shell/SiteShell";

// /partner: the shell shows the login; once logged in, each partner goes to their own app.
export default function PartnerHome() {
  const { account } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (account && account.role !== "customer") router.replace(homeFor(account.role));
  }, [account, router]);
  return null;
}
