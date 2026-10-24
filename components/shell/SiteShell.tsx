"use client";

import { NotificationBell } from "./NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bike, Briefcase, ChevronDown, Hammer, HeartHandshake, Home, LayoutDashboard, LifeBuoy, LogOut, MapPin, MessageCircleMore, UserRound, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { LangToggle } from "../LangToggle";
import { useLang } from "../LanguageProvider";
import { Logo } from "../Logo";
import { OfflineBanner } from "../OfflineBanner";
import { useSession } from "../SessionProvider";
import { JudgeBar } from "./JudgeBar";
import { SiteFooter } from "./SiteFooter";

type Tab = { href: string; label: string; icon: typeof Home; active: boolean };

/** Where each role lands after logging in. */
export const homeFor = (role: Role) => (role === "karigar" ? "/karigar" : role === "saathi" ? "/saathi" : role === "admin" ? "/admin" : "/");

/**
 * One website for everyone. Customers see Home, My Repairs, Resolve Hub, Talk and Care. Karigars,
 * Saathis and the Sudhaar team use the same site: their dashboards sit behind a login (PartnerGate),
 * and the menu shows what their role can open. The server enforces the same rules on every API.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t } = useLang();
  const { account, loading } = useSession();
  const role = account?.role;
  const on = (...prefixes: string[]) => prefixes.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));

  const customerTabs: Tab[] = [
    { href: "/", label: t("navHome"), icon: Home, active: on("/", "/fix", "/karigars", "/ghar-safai") },
    { href: "/repairs", label: t("navRepairs"), icon: Wrench, active: on("/repairs", "/orders") },
    { href: "/resolve", label: t("navResolve"), icon: LifeBuoy, active: on("/resolve") },
    { href: "/agent", label: t("navTalk"), icon: MessageCircleMore, active: on("/agent") },
    { href: "/care", label: "Care", icon: HeartHandshake, active: on("/care") },
  ];
  const partnerTabs: Record<Exclude<Role, "customer">, Tab[]> = {
    karigar: [{ href: "/karigar", label: t("navKarigarApp"), icon: Hammer, active: on("/karigar") }],
    saathi: [{ href: "/saathi", label: t("navSaathiApp"), icon: Bike, active: on("/saathi") }],
    admin: [
      { href: "/admin", label: t("navAdmin"), icon: LayoutDashboard, active: on("/admin") },
      { href: "/karigar", label: t("navKarigarApp"), icon: Hammer, active: on("/karigar") },
      { href: "/saathi", label: t("navSaathiApp"), icon: Bike, active: on("/saathi") },
    ],
  };
  const homeTab: Tab = { href: "/", label: t("navHome"), icon: Home, active: on("/") };
  const tabs = !role || role === "customer" ? customerTabs : [homeTab, ...partnerTabs[role]];
  const mobileTabs = !role || role === "customer" ? [...customerTabs.slice(0, 4), { href: "/profile", label: t("navProfile"), icon: UserRound, active: on("/profile") }] : tabs;

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo href={role && role !== "customer" ? homeFor(role) : "/"} />
          {role === "customer" && (
            <Link href="/profile#location" className="ml-1 hidden max-w-40 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border hover:text-foreground xl:flex">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{account?.address ?? t("locSet")}</span>
            </Link>
          )}
          <nav className="mx-auto hidden items-center gap-0.5 md:flex">
            {tabs.map((tb) => (
              <Link key={tb.href} href={tb.href} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition", tb.active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <tb.icon className="size-4" /> {tb.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {(!role || role === "customer") && <PartnersMenu />}
            <LangToggle />
            {!loading && account && <NotificationBell />}
            {!loading && <AccountMenu />}
          </div>
        </div>
      </header>
      <JudgeBar />
      <OfflineBanner />
      <main className="mx-auto w-full max-w-6xl px-4 pt-5">{children}</main>
      <SiteFooter />
      <nav className={cn("fixed inset-x-3 bottom-3 z-40 grid rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden", mobileTabs.length === 5 ? "grid-cols-5" : mobileTabs.length === 4 ? "grid-cols-4" : mobileTabs.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {mobileTabs.map((tb) => (
          <Link key={tb.href} href={tb.href} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition", tb.active ? "bg-primary/15 text-primary" : "text-muted-foreground")}>
            <tb.icon className="size-5" />
            <span className="max-w-full truncate px-0.5">{tb.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open, close]);
  return ref;
}

/** "Partners" menu for visitors: log in to a dashboard, or join as a karigar / Saathi. */
function PartnersMenu() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border hover:text-foreground">
        <Briefcase className="size-3.5" /> {t("ftPartners")} <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-64 space-y-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
          <MenuLink href="/partner" icon={LayoutDashboard} title={t("pmLogin")} sub={t("pmLoginSub")} />
          <MenuLink href="/join" icon={Hammer} title={t("pmJoinK")} sub={t("pmJoinKSub")} />
          <MenuLink href="/join?as=saathi" icon={Bike} title={t("pmJoinS")} sub={t("pmJoinSSub")} />
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, title, sub }: { href: string; icon: typeof Home; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-muted">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
    </Link>
  );
}

/** The signed-in person: profile or dashboard, and sign out. Logged out: Log in. */
function AccountMenu() {
  const { t } = useLang();
  const path = usePathname();
  const router = useRouter();
  const { account, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  useEffect(() => setOpen(false), [path]);
  if (!account)
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
        {t("login")}
      </Link>
    );
  const partner = account.role !== "customer";
  const roleLabel = account.role === "customer" ? t("roleCustomer") : account.role === "karigar" ? t("roleKarigar") : account.role === "saathi" ? t("roleSaathi") : t("roleAdmin");
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex max-w-40 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold ring-1 ring-border">
        <UserRound className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">{account.name.split(" ")[0]}</span>
        {account.care && <HeartHandshake className="size-3.5 shrink-0 text-teal" aria-label="Sudhaar Care" />}
        <ChevronDown className="size-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-60 space-y-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold">{account.name}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
          {partner ? (
            <MenuLink href={homeFor(account.role)} icon={LayoutDashboard} title={t("pmMyDashboard")} sub={roleLabel} />
          ) : (
            <>
              <MenuLink href="/profile" icon={UserRound} title={t("navProfile")} sub={t("pmProfileSub")} />
              <MenuLink href="/repairs" icon={Wrench} title={t("navRepairs")} sub={t("pmRepairsSub")} />
              <MenuLink href="/resolve" icon={LifeBuoy} title={t("navResolve")} sub={t("pmResolveSub")} />
            </>
          )}
          <button
            onClick={async () => {
              await logout();
              router.push(partner ? "/partner" : "/");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-sm hover:bg-muted"
          >
            <LogOut className="size-4 text-muted-foreground" /> {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
