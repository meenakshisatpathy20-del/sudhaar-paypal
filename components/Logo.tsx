import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", suffix, className }: { href?: string; suffix?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-teal-600 font-display text-lg font-bold text-primary-foreground shadow-[0_0_24px_-4px] shadow-primary/70">
        S
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-gold ring-2 ring-background" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Sudhaar{suffix && <span className="ml-1.5 text-xs font-medium text-muted-foreground">{suffix}</span>}
      </span>
    </Link>
  );
}
