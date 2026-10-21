import { cn } from "@/lib/utils";

/** Approximate rupee value next to USD sandbox prices, for Indian customers (~₹85 per $1). */
export const INR_PER_USD = 85;
export function Inr({ usd, className }: { usd: number; className?: string }) {
  return <span className={cn("text-[11px] font-medium text-muted-foreground", className)}>≈ ₹{Math.round(usd * INR_PER_USD).toLocaleString("en-IN")}</span>;
}
