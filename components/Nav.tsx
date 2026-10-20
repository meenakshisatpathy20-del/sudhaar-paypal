"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeBadges } from "./ModeBadges";

const LINKS = [
  { href: "/", label: "Customer" },
  { href: "/agent", label: "Repair Agent" },
  { href: "/saathi", label: "Saathi" },
  { href: "/karigar", label: "Karigar" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-wide">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-lg font-extrabold text-white">S</span>
          <span>
            Sudhaar <span className="hidden text-xs font-medium text-muted sm:inline">Repair, don&apos;t replace</span>
          </span>
        </Link>
        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" || path.startsWith("/orders") : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-brand-light text-brand-dark" : "text-muted hover:bg-gray-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="order-2 ml-auto sm:order-3">
          <ModeBadges />
        </div>
      </div>
    </header>
  );
}
