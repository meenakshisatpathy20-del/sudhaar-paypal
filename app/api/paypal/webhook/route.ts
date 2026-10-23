import { careWebhook } from "@/lib/care";
import { updateDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { verifyWebhook } from "@/lib/paypal";

// PayPal webhook receiver. Subscribe it to PAYMENT.AUTHORIZATION.CREATED, PAYMENT.CAPTURE.COMPLETED,
// PAYMENT.CAPTURE.REFUNDED, PAYMENT.PAYOUTSBATCH.SUCCESS, PAYMENT.PAYOUTS-ITEM.SUCCEEDED, INVOICING.INVOICE.PAID,
// and for Sudhaar Care: BILLING.SUBSCRIPTION.ACTIVATED / CANCELLED / SUSPENDED / EXPIRED and PAYMENT.SALE.COMPLETED.
type Resource = { id?: string; custom_id?: string; status?: string; billing_agreement_id?: string; billing_info?: { next_billing_time?: string } };

export async function POST(req: Request) {
  const event = (await req.json().catch(() => null)) as { event_type?: string; resource?: Resource } | null;
  if (!event?.event_type) return ok({ ignored: true });
  let verified = false;
  try {
    verified = await verifyWebhook(req.headers, event);
  } catch {
    verified = false;
  }
  // Only a verified event may change anything; unverified ones are just logged for the admin.
  const type = event.event_type;
  if (verified && (type.startsWith("BILLING.SUBSCRIPTION.") || type === "PAYMENT.SALE.COMPLETED")) await careWebhook(type, event.resource ?? {});
  await updateDB((db) => {
    db.webhooks.push({ at: new Date().toISOString(), type, resource: event.resource?.id, verified });
    if (db.webhooks.length > 200) db.webhooks.splice(0, db.webhooks.length - 200);
    if (verified) {
      const o = db.orders.find(
        (x) =>
          x.paypal.authorizationId === event.resource?.id ||
          x.paypal.captureId === event.resource?.id ||
          x.paypal.payoutBatchId === event.resource?.id ||
          x.id === event.resource?.custom_id,
      );
      o?.events.push({ at: new Date().toISOString(), actor: "system", kind: "paypal", message: `PayPal webhook received: ${type}`, ref: event.resource?.id });
    }
  });
  return ok({ received: true, verified });
}
