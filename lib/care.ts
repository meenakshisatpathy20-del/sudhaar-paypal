import { readDB, updateDB } from "./db";
import { FlowError } from "./orders";
import { cancelSubscription, createCarePlan, createCareProduct, createSubscription, describePayPalError, getSubscription, paypalMode } from "./paypal";
import { CARE_PRICE_USD } from "./pricing";
import type { Account, CareMembership } from "./types";

// Sudhaar Care: a monthly PayPal subscription. Members get free doorstep pickup (Sudhaar pays the
// Saathi's share from the subscription) and a 30-day repair warranty instead of 15 days.
//   Catalog Products API -> Billing Plans API -> Subscriptions API (approve on PayPal, then return here)

export const CARE_BENEFITS = ["Free doorstep pickup and delivery on every repair", "30-day repair warranty instead of 15 days", "Ghar Safai baskets picked up free too"];

export const careActive = (a: Pick<Account, "care"> | null | undefined) => a?.care?.status === "ACTIVE";

/** The billing plan, created in PayPal the first time anyone subscribes (and again if the mode changes). */
async function ensurePlan(): Promise<string> {
  const mode = paypalMode();
  const existing = readDB().care;
  if (existing?.planId && existing.mode === mode) return existing.planId;
  const productId = existing?.productId && existing.mode === mode ? existing.productId : await createCareProduct();
  const planId = await createCarePlan(productId, CARE_PRICE_USD);
  await updateDB((db) => {
    db.care = { productId, planId, mode };
  });
  return planId;
}

/** Starts a subscription and returns PayPal's approval link for the customer. */
export async function startCare(account: Account, origin: string): Promise<{ approveUrl: string }> {
  if (account.role !== "customer") throw new FlowError("Only customers can join Sudhaar Care", 403);
  if (careActive(account)) throw new FlowError("You're already a Sudhaar Care member");
  try {
    const planId = await ensurePlan();
    const sub = await createSubscription(planId, account.id, `${origin}/api/care/return`, `${origin}/care?status=cancelled`);
    if (!sub.approveUrl) throw new FlowError("PayPal did not return an approval link", 502);
    await setMembership(account.id, { subscriptionId: sub.id, status: "APPROVAL_PENDING", mode: paypalMode(), startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return { approveUrl: sub.approveUrl };
  } catch (e) {
    if (e instanceof FlowError) throw e;
    throw new FlowError(`Could not start the PayPal subscription: ${describePayPalError(e).message}`, 502);
  }
}

/** PayPal sends the customer back here after they approve. We ask PayPal for the real status. */
export async function confirmCare(account: Account, subscriptionId: string): Promise<CareMembership> {
  const mine = account.care?.subscriptionId;
  if (!mine || mine !== subscriptionId) throw new FlowError("This subscription doesn't belong to your account", 403);
  const info = await getSubscription(subscriptionId);
  if (info.customId && info.customId !== account.id) throw new FlowError("This subscription doesn't belong to your account", 403);
  return setMembership(account.id, {
    ...account.care!,
    status: normaliseStatus(info.status),
    nextBillingAt: info.nextBillingAt,
    lastPaymentAt: info.lastPaymentAt ?? (info.status === "ACTIVE" ? new Date().toISOString() : undefined),
    updatedAt: new Date().toISOString(),
  });
}

export async function stopCare(account: Account): Promise<CareMembership> {
  const care = account.care;
  if (!care || !["ACTIVE", "APPROVED", "APPROVAL_PENDING", "SUSPENDED"].includes(care.status)) throw new FlowError("You don't have an active Sudhaar Care plan");
  try {
    if (care.status !== "APPROVAL_PENDING") await cancelSubscription(care.subscriptionId, "Cancelled by the customer in the Sudhaar app");
  } catch (e) {
    throw new FlowError(`PayPal could not cancel the subscription: ${describePayPalError(e).message}`, 502);
  }
  return setMembership(account.id, { ...care, status: "CANCELLED", updatedAt: new Date().toISOString() });
}

/** Webhook: BILLING.SUBSCRIPTION.* and PAYMENT.SALE.COMPLETED keep the membership in step with PayPal. */
export async function careWebhook(eventType: string, resource: { id?: string; status?: string; billing_agreement_id?: string; billing_info?: { next_billing_time?: string } }) {
  const subId = eventType === "PAYMENT.SALE.COMPLETED" ? resource.billing_agreement_id : resource.id;
  if (!subId) return false;
  return updateDB((db) => {
    const a = db.accounts.find((x) => x.care?.subscriptionId === subId);
    if (!a?.care) return false;
    const now = new Date().toISOString();
    if (eventType === "PAYMENT.SALE.COMPLETED") a.care.lastPaymentAt = now;
    else if (resource.status) a.care.status = normaliseStatus(resource.status);
    else if (eventType.endsWith(".CANCELLED")) a.care.status = "CANCELLED";
    else if (eventType.endsWith(".ACTIVATED")) a.care.status = "ACTIVE";
    if (resource.billing_info?.next_billing_time) a.care.nextBillingAt = resource.billing_info.next_billing_time;
    a.care.updatedAt = now;
    return true;
  });
}

const STATUSES: CareMembership["status"][] = ["APPROVAL_PENDING", "APPROVED", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"];
const normaliseStatus = (s: string): CareMembership["status"] => (STATUSES.includes(s as CareMembership["status"]) ? (s as CareMembership["status"]) : "APPROVAL_PENDING");

async function setMembership(accountId: string, care: CareMembership) {
  return updateDB((db) => {
    const a = db.accounts.find((x) => x.id === accountId);
    if (!a) throw new FlowError("Account not found", 404);
    a.care = care;
    return care;
  });
}

/** Where PayPal should send the customer back: this server's public address. */
export function originOf(req: Request) {
  const fixed = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (fixed) return fixed;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}
