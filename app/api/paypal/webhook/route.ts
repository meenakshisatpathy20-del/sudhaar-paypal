import { updateDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { verifyWebhook } from "@/lib/paypal";

// PayPal webhook receiver. Subscribe it to PAYMENT.AUTHORIZATION.CREATED, PAYMENT.CAPTURE.COMPLETED,
// PAYMENT.CAPTURE.REFUNDED, PAYMENT.PAYOUTSBATCH.SUCCESS, PAYMENT.PAYOUTS-ITEM.SUCCEEDED and INVOICING.INVOICE.PAID.
export async function POST(req: Request) {
  const event = (await req.json().catch(() => null)) as { event_type?: string; resource?: { id?: string; custom_id?: string } } | null;
  if (!event?.event_type) return ok({ ignored: true });
  let verified = false;
  try {
    verified = await verifyWebhook(req.headers, event);
  } catch {
    verified = false;
  }
  await updateDB((db) => {
    db.webhooks.push({ at: new Date().toISOString(), type: event.event_type!, resource: event.resource?.id, verified });
    if (db.webhooks.length > 200) db.webhooks.splice(0, db.webhooks.length - 200);
    if (verified) {
      const o = db.orders.find(
        (x) =>
          x.paypal.authorizationId === event.resource?.id ||
          x.paypal.captureId === event.resource?.id ||
          x.paypal.payoutBatchId === event.resource?.id ||
          x.id === event.resource?.custom_id,
      );
      o?.events.push({ at: new Date().toISOString(), actor: "system", kind: "paypal", message: `PayPal webhook received: ${event.event_type}`, ref: event.resource?.id });
    }
  });
  return ok({ received: true, verified });
}
