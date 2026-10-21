import * as React from "react";
import { cn } from "@/lib/utils";

/** Initials avatar with a karigar's colour. */
function Avatar({ name, color, className }: { name: string; color?: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white ring-1 ring-border", className)}
      style={{ background: `linear-gradient(135deg, ${color ?? "#0f766e"}, ${color ?? "#0f766e"}99)` }}
    >
      {initials}
    </span>
  );
}

export { Avatar };
