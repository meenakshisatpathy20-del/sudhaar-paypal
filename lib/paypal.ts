import crypto from "node:crypto";
import { config, paypalEnabled } from "./config";
import type { Order } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Thin client for the PayPal REST APIs Sudhaar uses (all in the PayPal sandbox):
//   Orders v2 (intent AUTHORIZE) -> Payments v2 (capture / void / refund)
//   Payouts v1 (split to karigar + saathi) -> Invoicing v2 (digital bill)
//   Catalog Products + Billing Plans + Subscriptions v1 (Sudhaar Care)
//   Webhooks v1 (signature verification)
// When no sandbox credentials are configured the same functions return clearly
// marked simulated ids, so the app still runs end to end for local development.

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public debugId?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const sim = (prefix: string) => `SIM-${prefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
const money = (value: number) => ({ currency_code: config.currency, value: value.toFixed(2) });

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  const basic = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64");
  const res = await fetch(`${config.paypal.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayPalError(`PayPal auth failed: ${json.error_description ?? res.statusText}`, res.status);
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

/** Asks PayPal for a fresh access token: proves the Client ID and Secret work. */
export async function verifyPayPalKeys(): Promise<{ ok: true } | { ok: false; status?: number; message: string }> {
  token = null;
  try {
    await accessToken();
    return { ok: true };
  } catch (e) {
    return { ok: false, status: (e as PayPalError).status, message: (e as Error).message };
  }
}

async function pp<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown; requestId?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;
  const res = await fetch(`${config.paypal.apiBase}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json.details?.[0];
    const msg = detail ? `${detail.issue}: ${detail.description ?? ""}` : json.message ?? res.statusText;
    throw new PayPalError(`PayPal ${path} failed (${res.status}) ${msg}`, res.status, json.debug_id, json.details);
  }
  return json as T;
}

export const paypalMode = () => (paypalEnabled() ? "sandbox" : "simulated") as "sandbox" | "simulated";

// ---------- Orders v2: create with intent AUTHORIZE (funds held, not taken) ----------

export async function createAuthorizeOrder(order: Order): Promise<{ id: string }> {
  if (!paypalEnabled()) return { id: sim("ORDER") };
  const repairLines = order.jobs?.length
    ? order.jobs.map((j) => ({ name: `Repair: ${j.item}`.slice(0, 127), quantity: "1", unit_amount: money(j.price), description: j.issue.slice(0, 127) }))
    : [{ name: `Repair: ${order.item}`.slice(0, 127), quantity: "1", unit_amount: money(order.repairCharge), description: order.issue.slice(0, 127) }];
  const items = [
    ...repairLines,
    {
      name: order.kind === "basket" ? `One-trip Saathi pickup & delivery (${order.jobs?.length} items)` : order.mode === "pickup" ? `Doorstep pickup & delivery (${order.distanceKm} km)` : "Home visit fee",
      quantity: "1",
      unit_amount: money(order.pickupFee),
    },
  ];
  if (order.donation > 0) items.push({ name: "Karigar tool fund (donation)", quantity: "1", unit_amount: money(order.donation) });
  // Coupons and Sudhaar Care show up in PayPal as a discount on the full price.
  const discount = round2((order.discount?.care ?? 0) + (order.discount?.coupon?.amount ?? 0));
  const itemTotal = round2(order.total + discount);
  const body = {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        reference_id: order.id,
        custom_id: order.id,
        invoice_id: `${order.id}-${Date.now()}`,
        description: `Sudhaar repair ${order.id}`,
        soft_descriptor: "SUDHAAR",
        amount: { ...money(order.total), breakdown: discount > 0 ? { item_total: money(itemTotal), discount: money(discount) } : { item_total: money(order.total) } },
        items,
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Sudhaar",
          shipping_preference: "NO_SHIPPING",
          user_action: "CONTINUE",
        },
      },
    },
  };
  const res = await pp<{ id: string }>("/v2/checkout/orders", { method: "POST", body, requestId: `create-${order.id}-${order.total}` });
  return { id: res.id };
}

/** A second hold for just the extra amount when the customer approves a higher repair price. */
export async function createTopUpOrder(order: Order, amount: number, reason: string): Promise<{ id: string }> {
  if (!paypalEnabled()) return { id: sim("ORDER") };
  const body = {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        reference_id: `${order.id}-extra`,
        custom_id: order.id,
        invoice_id: `${order.id}-extra-${Date.now()}`,
        description: `Sudhaar ${order.id}: extra repair work`,
        soft_descriptor: "SUDHAAR",
        amount: { ...money(amount), breakdown: { item_total: money(amount) } },
        items: [{ name: `Extra repair work: ${order.item}`.slice(0, 127), quantity: "1", unit_amount: money(amount), description: reason.slice(0, 127) }],
      },
    ],
    payment_source: { paypal: { experience_context: { brand_name: "Sudhaar", shipping_preference: "NO_SHIPPING", user_action: "CONTINUE" } } },
  };
  const res = await pp<{ id: string }>("/v2/checkout/orders", { method: "POST", body, requestId: `topup-${order.id}-${amount}` });
  return { id: res.id };
}

/** A thank-you tip: intent CAPTURE, because a tip is paid straight away rather than held. */
export async function createTipOrder(order: Order, tipId: string, karigarShop: string, amount: number): Promise<{ id: string }> {
  if (!paypalEnabled()) return { id: sim("ORDER") };
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `${order.id}-${tipId}`,
        custom_id: order.id,
        invoice_id: `${order.id}-${tipId}`,
        description: `Sudhaar ${order.id}: thank-you tip for ${karigarShop}`.slice(0, 127),
        soft_descriptor: "SUDHAAR TIP",
        amount: { ...money(amount), breakdown: { item_total: money(amount) } },
        items: [{ name: `Tip for ${karigarShop}`.slice(0, 127), quantity: "1", unit_amount: money(amount) }],
      },
    ],
    payment_source: { paypal: { experience_context: { brand_name: "Sudhaar", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } },
  };
  const res = await pp<{ id: string }>("/v2/checkout/orders", { method: "POST", body, requestId: `tip-${order.id}-${tipId}` });
  return { id: res.id };
}

/** Captures an intent-CAPTURE order right after the buyer approves it. */
export async function captureOrder(paypalOrderId: string): Promise<{ captureId: string; status: string }> {
  if (!paypalEnabled()) return { captureId: sim("CAPTURE"), status: "COMPLETED" };
  const res = await pp<{ status: string; purchase_units: { payments: { captures: { id: string; status: string }[] } }[] }>(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    body: {},
    requestId: `capture-order-${paypalOrderId}`,
  });
  const cap = res.purchase_units[0].payments.captures[0];
  return { captureId: cap.id, status: cap.status };
}

export async function authorizeOrder(paypalOrderId: string): Promise<{ authorizationId: string; status: string; payerEmail?: string }> {
  if (!paypalEnabled()) return { authorizationId: sim("AUTH"), status: "CREATED" };
  const res = await pp<{
    payer?: { email_address?: string };
    purchase_units: { payments: { authorizations: { id: string; status: string }[] } }[];
  }>(`/v2/checkout/orders/${paypalOrderId}/authorize`, { method: "POST", body: {}, requestId: `auth-${paypalOrderId}` });
  const auth = res.purchase_units[0].payments.authorizations[0];
  return { authorizationId: auth.id, status: auth.status, payerEmail: res.payer?.email_address };
}

// ---------- Payments v2: capture / void / refund ----------

export async function captureAuthorization(authorizationId: string, amount: number, orderId: string): Promise<{ captureId: string; status: string }> {
  if (!paypalEnabled()) return { captureId: sim("CAPTURE"), status: "COMPLETED" };
  const res = await pp<{ id: string; status: string }>(`/v2/payments/authorizations/${authorizationId}/capture`, {
    method: "POST",
    body: { amount: money(amount), final_capture: true, note_to_payer: `Sudhaar ${orderId}: item delivered and confirmed with OTP.` },
    requestId: `capture-${authorizationId}`,
  });
  return { captureId: res.id, status: res.status };
}

export async function voidAuthorization(authorizationId: string): Promise<void> {
  if (!paypalEnabled()) return;
  await pp(`/v2/payments/authorizations/${authorizationId}/void`, { method: "POST", requestId: `void-${authorizationId}` });
}

export async function refundCapture(captureId: string, amount: number, note: string, key: string): Promise<{ refundId: string; status: string }> {
  if (!paypalEnabled()) return { refundId: sim("REFUND"), status: "COMPLETED" };
  const res = await pp<{ id: string; status: string }>(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    body: { amount: money(amount), note_to_payer: note.slice(0, 255) },
    requestId: `refund-${captureId}-${key}`,
  });
  return { refundId: res.id, status: res.status };
}

// ---------- Payouts v1: instant split to the karigar and the saathi ----------

export async function sendPayouts(
  orderId: string,
  lines: { receiver: string; amount: number; note: string; ref: string }[],
  /** Each batch needs its own id: the order's main payout uses the order id, a tip its own key. */
  batchKey = orderId,
): Promise<{ batchId: string; status: string }> {
  if (!paypalEnabled()) return { batchId: sim("PAYOUT"), status: "SUCCESS" };
  const res = await pp<{ batch_header: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: {
        sender_batch_id: `sudhaar-${batchKey}`,
        email_subject: "You have a Sudhaar payout",
        email_message: "Thank you for the repair. Your share has been paid instantly by Sudhaar.",
      },
      items: lines.map((l) => ({
        recipient_type: "EMAIL",
        amount: { value: l.amount.toFixed(2), currency: config.currency },
        receiver: l.receiver,
        note: l.note,
        sender_item_id: l.ref,
      })),
    },
    requestId: `payout-${batchKey}`,
  });
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

export async function getPayoutBatch(batchId: string): Promise<{ status: string; items: { status: string; ref: string; itemId: string }[] }> {
  if (!paypalEnabled() || batchId.startsWith("SIM-")) return { status: "SUCCESS", items: [] };
  const res = await pp<{
    batch_header: { batch_status: string };
    items: { payout_item_id: string; transaction_status: string; payout_item: { sender_item_id: string } }[];
  }>(`/v1/payments/payouts/${batchId}`);
  return {
    status: res.batch_header.batch_status,
    items: res.items.map((i) => ({ status: i.transaction_status, ref: i.payout_item.sender_item_id, itemId: i.payout_item_id })),
  };
}

// ---------- Invoicing v2: the digital bill used by Resolve Hub ----------

export async function createPaidInvoice(order: Order, payerEmail: string): Promise<{ invoiceId: string; url?: string }> {
  if (!paypalEnabled()) return { invoiceId: sim("INV") };
  const next = await pp<{ invoice_number: string }>("/v2/invoicing/generate-next-invoice-number", { method: "POST" });
  const lines = [
    ...(order.jobs?.length
      ? order.jobs.map((j) => ({ name: `Repair: ${j.item}`.slice(0, 200), description: j.issue.slice(0, 1000), quantity: "1", unit_amount: money(j.price) }))
      : [{ name: `Repair: ${order.item}`.slice(0, 200), description: order.issue.slice(0, 1000), quantity: "1", unit_amount: money(order.repairCharge) }]),
    { name: order.mode === "pickup" ? "Doorstep pickup & delivery" : "Home visit fee", quantity: "1", unit_amount: money(order.pickupFee) },
  ];
  if (order.donation > 0) lines.push({ name: "Karigar tool fund (donation)", description: "", quantity: "1", unit_amount: money(order.donation) });
  const created = await pp<{ id?: string; href?: string }>("/v2/invoicing/invoices", {
    method: "POST",
    body: {
      detail: {
        invoice_number: next.invoice_number,
        currency_code: config.currency,
        note: `Sudhaar order ${order.id}. Covered by a 15-day repair warranty. Raise any issue in Resolve Hub.`,
        terms_and_conditions: "Repair warranty: if the same problem returns within 15 days, Sudhaar re-repairs it free or refunds.",
        memo: `PayPal capture ${order.paypal.captureId ?? ""}`,
      },
      invoicer: { business_name: "Sudhaar – Repair, don't replace" },
      primary_recipients: [{ billing_info: { email_address: payerEmail } }],
      items: lines,
      ...(invoiceDiscount(order) > 0 ? { amount: { breakdown: { discount: { invoice_discount: { amount: money(invoiceDiscount(order)) } } } } } : {}),
    },
    requestId: `invoice-${order.id}`,
  });
  const invoiceId = created.id ?? created.href?.split("/").pop() ?? "";
  await pp(`/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    body: { send_to_invoicer: false, send_to_recipient: true, subject: `Your Sudhaar bill for ${order.item}` },
    requestId: `invoice-send-${order.id}`,
  });
  await pp(`/v2/invoicing/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: {
      method: "PAYPAL",
      payment_date: new Date().toISOString().slice(0, 10),
      amount: money(order.total),
      note: `Paid via PayPal capture ${order.paypal.captureId ?? ""}`,
    },
    requestId: `invoice-pay-${order.id}`,
  });
  const detail = await pp<{ detail?: { metadata?: { recipient_view_url?: string } } }>(`/v2/invoicing/invoices/${invoiceId}`);
  return { invoiceId, url: detail.detail?.metadata?.recipient_view_url };
}

const invoiceDiscount = (o: Order) => round2((o.discount?.care ?? 0) + (o.discount?.coupon?.amount ?? 0));

// ---------- Subscriptions v1: Sudhaar Care (catalog product -> billing plan -> subscription) ----------

export async function createCareProduct(): Promise<string> {
  if (!paypalEnabled()) return sim("PROD");
  const res = await pp<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: { name: "Sudhaar Care", description: "Monthly plan: free doorstep pickup on every repair and a 30-day repair warranty.", type: "SERVICE" },
    requestId: `care-product-${config.paypal.clientId.slice(0, 12)}`,
  });
  return res.id;
}

export async function createCarePlan(productId: string, priceUsd: number): Promise<string> {
  if (!paypalEnabled()) return sim("PLAN");
  const res = await pp<{ id: string }>("/v1/billing/plans", {
    method: "POST",
    body: {
      product_id: productId,
      name: "Sudhaar Care – monthly",
      description: "Free doorstep pickup on every repair, 30-day warranty",
      status: "ACTIVE",
      billing_cycles: [{ frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: money(priceUsd) } }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 },
    },
    requestId: `care-plan-${productId}`,
  });
  return res.id;
}

export type SubscriptionInfo = { id: string; status: string; customId?: string; nextBillingAt?: string; lastPaymentAt?: string; approveUrl?: string };

export async function createSubscription(planId: string, customId: string, returnUrl: string, cancelUrl: string): Promise<SubscriptionInfo> {
  if (!paypalEnabled()) {
    const id = sim("SUB");
    return { id, status: "APPROVAL_PENDING", customId, approveUrl: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}subscription_id=${id}` };
  }
  const res = await pp<{ id: string; status: string; links?: { rel: string; href: string }[] }>("/v1/billing/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      custom_id: customId,
      application_context: { brand_name: "Sudhaar", user_action: "SUBSCRIBE_NOW", shipping_preference: "NO_SHIPPING", return_url: returnUrl, cancel_url: cancelUrl },
    },
    requestId: `care-sub-${customId}-${Date.now()}`,
  });
  return { id: res.id, status: res.status, customId, approveUrl: res.links?.find((l) => l.rel === "approve")?.href };
}

export async function getSubscription(id: string): Promise<SubscriptionInfo> {
  if (!paypalEnabled() || id.startsWith("SIM-")) return { id, status: "ACTIVE", nextBillingAt: new Date(Date.now() + 30 * 86400_000).toISOString() };
  const res = await pp<{ id: string; status: string; custom_id?: string; billing_info?: { next_billing_time?: string; last_payment?: { time?: string } } }>(`/v1/billing/subscriptions/${id}`);
  return { id: res.id, status: res.status, customId: res.custom_id, nextBillingAt: res.billing_info?.next_billing_time, lastPaymentAt: res.billing_info?.last_payment?.time };
}

export async function cancelSubscription(id: string, reason: string): Promise<void> {
  if (!paypalEnabled() || id.startsWith("SIM-")) return;
  await pp(`/v1/billing/subscriptions/${id}/cancel`, { method: "POST", body: { reason: reason.slice(0, 127) }, requestId: `care-cancel-${id}` });
}

// ---------- Webhooks v1: verify the signature of incoming events ----------

export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  if (!paypalEnabled() || !config.paypal.webhookId) return false;
  const res = await pp<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: config.paypal.webhookId,
      webhook_event: event,
    },
  });
  return res.verification_status === "SUCCESS";
}

export function describePayPalError(e: unknown): { message: string; ref?: string } {
  if (e instanceof PayPalError) return { message: e.message, ref: e.debugId ? `debug_id ${e.debugId}` : undefined };
  return { message: e instanceof Error ? e.message : String(e) };
}
