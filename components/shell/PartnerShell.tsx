"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bike, LayoutDashboard, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "../Logo";
import { ModeBadges } from "../ModeBadges";

const LINKS = [
  { href: "/saathi", label: "Saathi app", icon: Bike },
  { href: "/karigar", label: "Karigar app", icon: Hammer },
  { href: "/admin", label: "Operations", icon: LayoutDashboard },
];

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Logo href="/partner" suffix="Partners" />
          <nav className="order-3 flex w-full gap-1 overflow-x-auto no-scrollbar sm:order-2 sm:ml-4 sm:w-auto">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium", path.startsWith(l.href) ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <l.icon className="size-4" /> {l.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
            <ModeBadges compact />
            <Link href="/" className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Customer app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-5">{children}</main>
    </div>
  );
}
