import { INR_PER_USD } from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Customers see rupees. PayPal sandbox settles in USD, so totals also show the exact
// USD amount PayPal holds and captures (INR_PER_USD in lib/pricing).
const toRupees = (usd: number) => Math.round(usd * INR_PER_USD);
export const rupees = (usd: number) => `₹${toRupees(usd).toLocaleString("en-IN")}`;
/** A bill total in rupees: the sum of the rounded lines, so the bill always adds up. */
export const rupeeTotal = (...linesUsd: number[]) => `₹${linesUsd.reduce((s, u) => s + toRupees(u), 0).toLocaleString("en-IN")}`;

/** The exact USD amount PayPal moves, shown under rupee totals ("charges" for customers, "pays" for partners). */
export function UsdNote({ usd, verb = "charges", className }: { usd: number; verb?: "charges" | "pays"; className?: string }) {
  return <span className={cn("block text-[11px] font-medium text-muted-foreground", className)}>PayPal {verb} ${usd.toFixed(2)}</span>;
}
