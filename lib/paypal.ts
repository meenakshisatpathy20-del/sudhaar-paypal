import crypto from "node:crypto";
import { config, paypalEnabled } from "./config";
import type { Order } from "./types";

// Thin client for the PayPal REST APIs Sudhaar uses (all in the PayPal sandbox):
//   Orders v2 (intent AUTHORIZE) -> Payments v2 (capture / void / refund)
//   Payouts v1 (split to karigar + saathi) -> Invoicing v2 (digital bill)
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
  const body = {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        reference_id: order.id,
        custom_id: order.id,
        invoice_id: `${order.id}-${Date.now()}`,
        description: `Sudhaar repair ${order.id}`,
        soft_descriptor: "SUDHAAR",
        amount: { ...money(order.total), breakdown: { item_total: money(order.total) } },
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
): Promise<{ batchId: string; status: string }> {
  if (!paypalEnabled()) return { batchId: sim("PAYOUT"), status: "SUCCESS" };
  const res = await pp<{ batch_header: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: {
        sender_batch_id: `sudhaar-${orderId}`,
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
    requestId: `payout-${orderId}`,
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
