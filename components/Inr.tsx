"use client";

import { INR_PER_USD } from "@/lib/pricing";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLang } from "./LanguageProvider";

// Customers see rupees. PayPal sandbox settles in USD, so totals also show the exact
// USD amount PayPal holds and captures (INR_PER_USD in lib/pricing).
const toRupees = (usd: number) => Math.round(usd * INR_PER_USD);
export const rupees = (usd: number) => `₹${toRupees(usd).toLocaleString("en-IN")}`;
/** A bill total in rupees: the sum of the rounded lines, so the bill always adds up. */
export const rupeeTotal = (...linesUsd: number[]) => `₹${linesUsd.reduce((s, u) => s + toRupees(u), 0).toLocaleString("en-IN")}`;

/** An order's bill total in rupees, lines rounded the same way the bill shows them (discounts included). */
export const orderRupees = (o: Pick<Order, "jobs" | "repairCharge" | "pickupFee" | "donation" | "discount">) =>
  rupeeTotal(...(o.jobs?.length ? o.jobs.map((j) => j.price) : [o.repairCharge]), o.pickupFee, o.donation, -(o.discount?.care ?? 0), -(o.discount?.coupon?.amount ?? 0));

/** The exact USD amount PayPal moves, shown under rupee totals ("charges" for customers, "pays" for partners). */
export function UsdNote({ usd, verb = "charges", className }: { usd: number; verb?: "charges" | "pays"; className?: string }) {
  const { t } = useLang();
  return <span className={cn("block text-[11px] font-medium text-muted-foreground", className)}>{t(verb === "pays" ? "usdPays" : "usdCharges", { amount: `$${usd.toFixed(2)}` })}</span>;
}
