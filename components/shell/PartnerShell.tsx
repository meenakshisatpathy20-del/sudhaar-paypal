"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bike, Compass, Hammer, KeyRound, LayoutDashboard, Lock, LogOut } from "lucide-react";
import { api } from "../api";
import { LangToggle } from "../LangToggle";
import { Logo } from "../Logo";
import { ModeBadges } from "../ModeBadges";
import { useSession } from "../SessionProvider";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const LINKS: { href: string; label: string; icon: typeof Bike; roles: Role[] }[] = [
  { href: "/saathi", label: "Saathi app", icon: Bike, roles: ["saathi", "admin"] },
  { href: "/karigar", label: "Karigar app", icon: Hammer, roles: ["karigar", "admin"] },
  { href: "/admin", label: "Admin console", icon: LayoutDashboard, roles: ["admin"] },
];
const PARTNER_ROLES: Role[] = ["karigar", "saathi", "admin"];
export const homeFor = (role: Role) => (role === "karigar" ? "/karigar" : role === "saathi" ? "/saathi" : "/admin");

/**
 * The partner side: karigars, Saathis and the Sudhaar team each log in with their own phone + PIN
 * and see only their own app. The APIs enforce the same rules on the server.
 */
export function PartnerShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { account, loading, logout } = useSession();

  if (loading) return null;
  if (!account || !PARTNER_ROLES.includes(account.role)) return <PartnerLogin />;
  const links = LINKS.filter((l) => l.roles.includes(account.role));
  const page = LINKS.find((l) => path.startsWith(l.href));
  const allowed = !page || page.roles.includes(account.role);

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Logo href={homeFor(account.role)} suffix="Partners" />
          <nav className="order-3 flex w-full gap-1 overflow-x-auto no-scrollbar sm:order-2 sm:ml-4 sm:w-auto">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium", path.startsWith(l.href) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <l.icon className="size-4" /> {l.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
            <span className="hidden max-w-36 truncate rounded-full bg-muted px-2.5 py-1 text-xs font-semibold ring-1 ring-border sm:block">
              {account.name} · {account.role}
            </span>
            <Link href="/guide" className="hidden items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground md:flex">
              <Compass className="size-3.5" /> Guide
            </Link>
            {account.role !== "admin" && <LangToggle />}
            <ModeBadges compact />
            <button
              onClick={async () => {
                await logout();
                router.push("/partner");
              }}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-5">
        {allowed ? (
          children
        ) : (
          <Card className="mx-auto max-w-md">
            <CardContent className="space-y-3 text-center">
              <Lock className="mx-auto size-8 text-primary" />
              <p className="font-semibold">This app isn&apos;t part of your account.</p>
              <Button asChild>
                <Link href={homeFor(account.role)}>Go to my app</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function PartnerLogin() {
  const { account, refresh } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Role | null>(null);
  useEffect(() => {
    if (done) router.push(homeFor(done));
  }, [done, router]);

  async function go(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(path, body);
      const a = await refresh();
      if (a) setDone(a.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <Logo href="/" suffix="Partners" />
      <Card>
        <CardContent className="space-y-3">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Lock className="size-5 text-primary" /> Partner login
          </h1>
          <p className="text-sm text-muted-foreground">For karigars, Repair Saathis and the Sudhaar team. Each person sees only their own app.</p>
          {account?.role === "customer" && <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">You&apos;re logged in as a customer. Partner login switches this browser to a partner account.</p>}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              go("/api/auth/login", { phone, pin, area: "partner" });
            }}
          >
            <Input placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
            <Input placeholder="4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" autoComplete="current-password" />
            <Button className="w-full" type="submit" disabled={busy || pin.length !== 4 || phone.replace(/\D/g, "").length < 10}>
              <KeyRound /> Log in
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="space-y-2 rounded-xl bg-teal/10 p-3 ring-1 ring-teal/25">
            <p className="text-xs font-semibold">Judges: try a demo partner account</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["karigar", "Karigar", Hammer],
                  ["saathi", "Saathi", Bike],
                  ["admin", "Admin", LayoutDashboard],
                ] as const
              ).map(([role, label, Icon]) => (
                <Button key={role} variant="outline" size="sm" disabled={busy} onClick={() => go("/api/auth/demo", { role })}>
                  <Icon /> {label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">New karigars get their PIN from the Sudhaar team after the shop visit. A real launch would add SMS OTP.</p>
        </CardContent>
      </Card>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          ← Back to the customer app
        </Link>
        <Link href="/guide" className="hover:text-foreground">
          Demo guide
        </Link>
      </div>
    </div>
  );
}
