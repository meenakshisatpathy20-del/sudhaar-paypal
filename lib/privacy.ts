import { liveStats } from "./reviews";
import type { Account, Karigar, Order } from "./types";

// Customer-facing APIs never need anyone's payout email. The demo admin login is shared,
// so even admin views mask the personal details of people who joined through onboarding.

export const maskEmail = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, "$1•••$2");

export function publicKarigar(k: Karigar) {
  const { payoutEmail, ...rest } = liveStats(k);
  void payoutEmail;
  return rest;
}

export function publicOrder(o: Order): Order {
  const fp = o.familyPay;
  return {
    ...o,
    customer: { ...o.customer, email: maskEmail(o.customer.email) },
    familyPay: fp && { ...fp, email: fp.email && maskEmail(fp.email), paidBy: fp.paidBy && maskEmail(fp.paidBy), phone: fp.phone && `••••••${fp.phone.slice(-4)}` },
    payouts: o.payouts.map((p) => ({ ...p, receiver: maskEmail(p.receiver) })),
  };
}

/** Admin view: seeded demo karigars show their sandbox email; onboarded people are masked. */
export const adminKarigar = (k: Karigar): Karigar => (k.onboarded ? { ...liveStats(k), payoutEmail: maskEmail(k.payoutEmail) } : liveStats(k));

/**
 * The order as a given account may see it. OTPs prove the customer is present, so only the
 * customer and admins get them: a Saathi or karigar has to ask the customer.
 */
export function orderFor(a: Account | null, o: Order): Order {
  const base = publicOrder(o);
  if (a?.role === "admin") return base;
  // Internal Resolve Hub notes are for the Sudhaar team only.
  const complaints = base.complaints.map((c) => (c.thread?.some((m) => m.internal) ? { ...c, thread: c.thread.filter((m) => !m.internal) } : c));
  if (a && a.role === "customer" && o.customerId === a.id) return { ...base, complaints };
  return { ...base, complaints, pickupOtp: "", deliveryOtp: "", trackToken: undefined, familyPay: base.familyPay && { ...base.familyPay, token: undefined } };
}
