import { FlowError } from "./orders";
import { INR_PER_USD, platformShare, round2 } from "./pricing";
import type { Account, Coupon, DB } from "./types";

// Coupons are checked on the server for every booking. A discount always comes out of Sudhaar's
// own share (10% of the repair + 25% of the pickup fee), so the karigar and the Saathi are paid
// in full whatever code the customer uses.

export const normaliseCode = (code: unknown) => (typeof code === "string" ? code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) : "");

/** Bookings that went through (paid or later), which "first order" and "once each" count. */
const paidBookings = (db: DB, customerId: string) => db.orders.filter((o) => o.customerId === customerId && o.status !== "awaiting_payment" && o.status !== "cancelled");

export function couponDiscount(
  db: DB,
  rawCode: unknown,
  input: { customer: Account; repairCharge: number; pickupFee: number; careCovered: number; basket: boolean },
): { code: string; amount: number; description: string } {
  const code = normaliseCode(rawCode);
  const c = (db.coupons ?? []).find((x) => x.code === code);
  if (!c || !c.active) throw new FlowError("That coupon code isn't valid.");
  if (c.expiresAt && Date.parse(c.expiresAt) < Date.now()) throw new FlowError("That coupon has expired.");
  if (c.maxUses !== undefined && c.uses >= c.maxUses) throw new FlowError("That coupon has been fully used.");
  if (c.basketOnly && !input.basket) throw new FlowError(`${c.code} works on Ghar Safai baskets only.`);
  const past = paidBookings(db, input.customer.id);
  if (c.firstOrderOnly && past.length > 0) throw new FlowError(`${c.code} is for your first repair only.`);
  if (past.some((o) => o.discount?.coupon?.code === c.code)) throw new FlowError(`You've already used ${c.code}.`);
  const orderInr = (input.repairCharge + input.pickupFee - input.careCovered) * INR_PER_USD;
  if (c.minOrderInr && orderInr < c.minOrderInr) throw new FlowError(`${c.code} needs an order of at least ₹${c.minOrderInr}.`);
  const wanted = c.kind === "flat" ? c.value / INR_PER_USD : Math.min((input.repairCharge * c.value) / 100, (c.maxInr ?? Infinity) / INR_PER_USD);
  // Sudhaar pays for the discount, so it can't be more than what Sudhaar earns on this booking.
  const cap = Math.max(0, platformShare(input.repairCharge, input.pickupFee) - input.careCovered);
  const amount = round2(Math.min(wanted, cap));
  if (amount < 0.01) throw new FlowError(`${c.code} can't be used on this booking.`);
  return { code: c.code, amount, description: c.description };
}

/** Admin: create or update a coupon. */
export function cleanCoupon(input: Partial<Coupon>, existing?: Coupon): Coupon {
  const code = normaliseCode(input.code ?? existing?.code);
  if (code.length < 4) throw new FlowError("Use a code of 4 to 20 letters or digits");
  const kind = input.kind === "percent" ? "percent" : input.kind === "flat" ? "flat" : (existing?.kind ?? "flat");
  const value = Number(input.value ?? existing?.value);
  if (!(value > 0) || (kind === "percent" && value > 50) || (kind === "flat" && value > 500)) throw new FlowError(kind === "percent" ? "Percent must be between 1 and 50" : "Amount must be between ₹1 and ₹500");
  const opt = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Math.max(0, Math.round(Number(v)))) || undefined;
  return {
    code,
    description: String(input.description ?? existing?.description ?? "").trim().slice(0, 80) || (kind === "flat" ? `₹${value} off` : `${value}% off`),
    kind,
    value: round2(value),
    maxInr: opt(input.maxInr ?? existing?.maxInr),
    minOrderInr: opt(input.minOrderInr ?? existing?.minOrderInr),
    maxUses: opt(input.maxUses ?? existing?.maxUses),
    firstOrderOnly: Boolean(input.firstOrderOnly ?? existing?.firstOrderOnly),
    basketOnly: Boolean(input.basketOnly ?? existing?.basketOnly),
    active: input.active === undefined ? (existing?.active ?? true) : Boolean(input.active),
    uses: existing?.uses ?? 0,
    expiresAt: input.expiresAt === undefined ? existing?.expiresAt : input.expiresAt || undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}
