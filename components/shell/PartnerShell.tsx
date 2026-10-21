"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, LayoutDashboard, Hammer, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "../Logo";
import { ModeBadges } from "../ModeBadges";
import { signOutStaff, StaffGate } from "./StaffGate";

const LINKS = [
  { href: "/saathi", label: "Saathi app", icon: Bike },
  { href: "/karigar", label: "Karigar app", icon: Hammer },
  { href: "/admin", label: "Admin console", icon: LayoutDashboard },
];

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <StaffGate>
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Logo href="/partner" suffix="Partners" />
          <nav className="order-3 flex w-full gap-1 overflow-x-auto no-scrollbar sm:order-2 sm:ml-4 sm:w-auto">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium", path.startsWith(l.href) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <l.icon className="size-4" /> {l.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
            <ModeBadges compact />
            <button onClick={signOutStaff} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-5">{children}</main>
    </div>
    </StaffGate>
  );
}
