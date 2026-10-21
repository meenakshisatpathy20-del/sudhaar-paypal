import type { Account, Karigar, Order } from "./types";

// Customer-facing APIs never need anyone's payout email. The demo has no staff login,
// so even admin views mask the personal details of people who joined through onboarding.

export const maskEmail = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, "$1•••$2");

export function publicKarigar(k: Karigar) {
  const { payoutEmail, ...rest } = k;
  void payoutEmail;
  return rest;
}

export function publicOrder(o: Order): Order {
  const fp = o.familyPay;
  return {
    ...o,
    customer: { ...o.customer, email: maskEmail(o.customer.email) },
    familyPay: fp && { ...fp, email: fp.email && maskEmail(fp.email), paidBy: fp.paidBy && maskEmail(fp.paidBy) },
    payouts: o.payouts.map((p) => ({ ...p, receiver: maskEmail(p.receiver) })),
  };
}

/** Admin view: seeded demo karigars show their sandbox email; onboarded people are masked. */
export const adminKarigar = (k: Karigar): Karigar => (k.onboarded ? { ...k, payoutEmail: maskEmail(k.payoutEmail) } : k);

/**
 * The order as a given account may see it. OTPs prove the customer is present, so only the
 * customer and admins get them: a Saathi or karigar has to ask the customer.
 */
export function orderFor(a: Account | null, o: Order): Order {
  const base = publicOrder(o);
  if (a && (a.role === "admin" || (a.role === "customer" && o.customerId === a.id))) return base;
  return { ...base, pickupOtp: "", deliveryOtp: "", familyPay: base.familyPay && { ...base.familyPay, token: undefined } };
}
