"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, MessageCircleMore, UserRound, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { LangToggle } from "../LangToggle";
import { useLang } from "../LanguageProvider";
import { Logo } from "../Logo";
import { ModeBadges } from "../ModeBadges";
import { OfflineBanner } from "../OfflineBanner";

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t } = useLang();
  const tabs = [
    { href: "/", label: t("navHome"), icon: Home, active: path === "/" || path.startsWith("/fix") || path.startsWith("/karigars") },
    { href: "/repairs", label: t("navRepairs"), icon: Wrench, active: path.startsWith("/repairs") || path.startsWith("/orders") },
    { href: "/agent", label: t("navTalk"), icon: MessageCircleMore, active: path.startsWith("/agent") },
    { href: "/profile", label: t("navProfile"), icon: UserRound, active: path.startsWith("/profile") },
  ];
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <button className="ml-1 hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border sm:flex">
            <MapPin className="size-3.5 text-primary" /> {t("location")}
          </button>
          <nav className="mx-auto hidden items-center gap-1 md:flex">
            {tabs.map((tb) => (
              <Link key={tb.href} href={tb.href} className={cn("flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition", tb.active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <tb.icon className="size-4" /> {tb.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <div className="hidden lg:block">
              <ModeBadges />
            </div>
            <LangToggle />
          </div>
        </div>
      </header>
      <OfflineBanner />
      <main className="mx-auto w-full max-w-6xl px-4 pt-5">{children}</main>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden">
        {tabs.map((tb) => (
          <Link key={tb.href} href={tb.href} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition", tb.active ? "bg-primary/15 text-primary" : "text-muted-foreground")}>
            <tb.icon className="size-5" />
            {tb.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
