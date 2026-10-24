"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bike, Hammer, KeyRound, LayoutDashboard, Lock } from "lucide-react";
import type { Role } from "@/lib/types";
import { api } from "../api";
import { useLang } from "../LanguageProvider";
import { useSession } from "../SessionProvider";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { homeFor } from "./SiteShell";

// Which roles may open each partner page. Admins can look at any karigar's or Saathi's view.
const ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/saathi", roles: ["saathi", "admin"] },
  { prefix: "/karigar", roles: ["karigar", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];
const PARTNER_ROLES: Role[] = ["karigar", "saathi", "admin"];

/**
 * The karigar, Saathi and admin pages are part of the main website but need a partner login.
 * Customers (and visitors) see the login here instead of the dashboard; the APIs check the same.
 */
export function PartnerGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t } = useLang();
  const { account, loading } = useSession();
  if (loading) return <Card className="h-48 animate-pulse" />;
  if (!account || !PARTNER_ROLES.includes(account.role)) return <PartnerLogin />;
  const rule = ACCESS.find((a) => path.startsWith(a.prefix));
  if (rule && !rule.roles.includes(account.role))
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-3 text-center">
          <Lock className="mx-auto size-8 text-primary" />
          <p className="font-semibold">{t("pgNotYours")}</p>
          <Button asChild>
            <Link href={homeFor(account.role)}>{t("pmMyDashboard")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  return <>{children}</>;
}

export function PartnerLogin() {
  const { t } = useLang();
  const { account, refresh } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(url, body);
      const a = await refresh();
      // Stay on the page they asked for if their role may open it, else go to their own dashboard.
      const rule = ACCESS.find((x) => path.startsWith(x.prefix));
      if (a) router.push(rule && rule.roles.includes(a.role) ? path : homeFor(a.role));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardContent className="space-y-3">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Lock className="size-5 text-primary" /> {t("pgTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("pgSub")}</p>
          {account?.role === "customer" && <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">{t("pgCustomerNote")}</p>}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              go("/api/auth/login", { phone, pin, area: "partner" });
            }}
          >
            <Input placeholder={t("joinPhonePh")} aria-label={t("joinPhonePh")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
            <Input placeholder={t("pgPin")} aria-label={t("pgPin")} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" autoComplete="current-password" />
            <Button className="w-full" type="submit" disabled={busy || pin.length !== 4 || phone.replace(/\D/g, "").length < 10}>
              <KeyRound /> {t("btnLogin")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-[11px] text-muted-foreground">{t("pgPinNote")}</p>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className="bg-teal/5">
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold">{t("pgDemo")}</p>
            <div className="grid gap-2">
              {(
                [
                  ["karigar", t("roleKarigar"), Hammer, t("pgDemoK")],
                  ["saathi", t("roleSaathi"), Bike, t("pgDemoS")],
                  ["admin", t("roleAdmin"), LayoutDashboard, t("pgDemoA")],
                ] as const
              ).map(([role, label, Icon, sub]) => (
                <button key={role} disabled={busy} onClick={() => go("/api/auth/demo", { role })} className="flex items-start gap-3 rounded-xl bg-card p-3 text-left ring-1 ring-border hover:bg-muted disabled:opacity-60">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-muted-foreground">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          {t("pgNew")}{" "}
          <Link href="/join" className="font-semibold text-primary underline">
            {t("pmJoinK")}
          </Link>{" "}
          ·{" "}
          <Link href="/join?as=saathi" className="font-semibold text-primary underline">
            {t("pmJoinS")}
          </Link>
        </p>
      </div>
    </div>
  );
}
