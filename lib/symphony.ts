import { callbackEnabled, placeCall } from "./bolna";
import { readDB, updateDB } from "./db";
import { expireUnpaidOrders } from "./orders";
import { INR_PER_USD } from "./pricing";
import { notifyOrder } from "./sms";
import { slotLabel } from "./slots";
import type { DB, Order, VoiceCall } from "./types";

// The conductor: a background loop that keeps every person on a repair in step, by SMS and by
// outbound calls from the Bolna agent:
//  - the family payer gets a reminder SMS (and, for phone bookings, a call) if they haven't paid;
//  - an unpaid booking that expires is reported to the customer and the payer;
//  - before a pickup, phone customers get a reminder call and everyone an SMS.
// It runs every minute while the server is up (instrumentation.ts) and can be run from the admin console.

const MIN = 60_000;
const minutes = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};
export const timings = () => ({
  /** First payment reminder (SMS + call for phone bookings), then a second SMS. */
  firstReminderMin: minutes("REMINDER_FIRST_MIN", 120),
  secondReminderMin: minutes("REMINDER_SECOND_MIN", 20 * 60),
  /** How long before the pickup window the reminder goes out. */
  pickupLeadMin: minutes("PICKUP_REMINDER_MIN", 60),
});

const firstName = (n: string) => n.split(" ")[0];
const inr = (usd: number) => Math.round(usd * INR_PER_USD);

/** Place an outbound call with the Sudhaar agent and log it, so its transcript lands on the same entry. */
export async function conductCall(o: Order, to: string, reason: string, extra: Record<string, string> = {}): Promise<VoiceCall | null> {
  if (!callbackEnabled() || !/^[6-9]\d{9}$/.test(to)) return null;
  const demo = readDB().accounts.some((a) => a.demo && a.phone === to);
  const toPayer = reason === "payment_reminder";
  // The same variables as an incoming call, so one prompt handles both directions.
  const userData: Record<string, string> = {
    call_reason: reason,
    from_number: `+91${to}`,
    known_customer: "true",
    caller_name: toPayer ? (o.familyPay?.name ?? "") : firstName(o.customer.name),
    care_member: "false",
    summary: `${o.item}: ${o.status.replaceAll("_", " ")}`,
    order_id: o.id,
    item: o.item,
    customer_name: firstName(o.customer.name),
    payer_name: o.familyPay?.name ?? "",
    total_inr: String(inr(o.total)),
    pickup_time: o.pickupSlot ? slotLabel(o.pickupSlot, "hi-IN", { today: "आज", tomorrow: "कल" }) : "",
    ...extra,
  };
  const call: VoiceCall = { id: `out-${Date.now().toString(36)}`, at: new Date().toISOString(), direction: "outbound", to, reason, orderIds: [o.id], customerId: o.customerId };
  if (demo) call.status = "skipped (demo number)";
  else {
    try {
      const r = await placeCall(to, userData);
      if (r.callId) call.id = r.callId;
      call.status = r.status ?? "queued";
    } catch (e) {
      call.status = `failed: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  await updateDB((db) => {
    db.voiceCalls ??= [];
    db.voiceCalls.unshift(call);
    if (db.voiceCalls.length > 100) db.voiceCalls.length = 100;
  });
  return call;
}

const customerPhone = (o: Order) => readDB().accounts.find((a) => a.id === o.customerId && a.role === "customer")?.phone;

// Shared through globalThis, so the background loop and the admin "Run now" never run at the same time.
const lock = ((globalThis as { __sudhaarTick?: { running: boolean } }).__sudhaarTick ??= { running: false });

/** One pass of the conductor. Safe to call often: every nudge is recorded on the order and sent once. */
export async function tick(now = Date.now()) {
  if (lock.running) return { skipped: true, done: [] as string[] };
  lock.running = true;
  const done: string[] = [];
  try {
    // 1. Expired unpaid bookings are cancelled, and the customer and payer told (inside expireUnpaidOrders).
    for (const id of await expireUnpaidOrders()) done.push(`${id}: expired, customer told`);

    const t = timings();
    for (const o of readDB().orders) {
      const age = (now - Date.parse(o.createdAt)) / MIN;
      // 2. Waiting for the family payer: reminder SMS (and a call for phone bookings), then a second SMS.
      if (o.status === "awaiting_payment" && o.familyPay?.phone) {
        const sent = o.nudges?.payReminders ?? 0;
        const due = sent === 0 ? age >= t.firstReminderMin : sent === 1 ? age >= t.secondReminderMin : false;
        if (due) {
          await updateDB((db) => {
            const x = db.orders.find((y) => y.id === o.id);
            if (x) x.nudges = { ...x.nudges, payReminders: sent + 1 };
          });
          await notifyOrder(o.id, "pay_reminder");
          done.push(`${o.id}: payment reminder ${sent + 1}`);
          if (sent === 0 && o.bookedBy === "phone" && o.familyPay.phone !== customerPhone(o) && !o.nudges?.payCall) {
            await updateDB((db) => {
              const x = db.orders.find((y) => y.id === o.id);
              if (x) x.nudges = { ...x.nudges, payCall: true };
            });
            const call = await conductCall(o, o.familyPay.phone, "payment_reminder");
            if (call) done.push(`${o.id}: payment call to the payer (${call.status})`);
          }
        }
      }
      // 3. Pickup (or visit) coming up: SMS to the customer, and a reminder call for phone customers.
      if (o.status === "authorized" && o.pickupSlot && !o.nudges?.pickupSoon) {
        const until = (Date.parse(o.pickupSlot.start) - now) / MIN;
        if (until <= t.pickupLeadMin && until > -120) {
          await updateDB((db) => {
            const x = db.orders.find((y) => y.id === o.id);
            if (x) x.nudges = { ...x.nudges, pickupSoon: true };
          });
          await notifyOrder(o.id, "pickup_soon");
          done.push(`${o.id}: pickup reminder SMS`);
          const phone = customerPhone(o);
          if (o.bookedBy === "phone" && phone) {
            const call = await conductCall(o, phone, "pickup_reminder");
            if (call) done.push(`${o.id}: pickup reminder call (${call.status})`);
          }
        }
      }
    }
  } finally {
    lock.running = false;
  }
  return { done };
}

/** Start the loop once per server process. */
export function startConductor() {
  const g = globalThis as { __sudhaarConductor?: NodeJS.Timeout };
  if (g.__sudhaarConductor) return;
  const every = Number(process.env.CONDUCTOR_INTERVAL_SEC) > 0 ? Number(process.env.CONDUCTOR_INTERVAL_SEC) * 1000 : MIN;
  g.__sudhaarConductor = setInterval(() => {
    tick().catch((e) => console.error("[conductor]", (e as Error).message));
  }, every);
  g.__sudhaarConductor.unref?.();
}

/** What the voice line achieved: for the admin console (and the pitch). */
export function voiceStats(db: DB) {
  const calls = db.voiceCalls ?? [];
  const inbound = calls.filter((c) => c.direction !== "outbound");
  const outbound = calls.filter((c) => c.direction === "outbound");
  const phoneOrders = db.orders.filter((o) => o.bookedBy === "phone" && !o.warrantyFor);
  const paid = phoneOrders.filter((o) => o.paypal.authorizationId);
  const remindedThenPaid = paid.filter((o) => (o.nudges?.payReminders ?? 0) > 0);
  const durations = inbound.map((c) => c.durationSec ?? 0).filter((d) => d > 0);
  return {
    inbound: inbound.length,
    outbound: outbound.length,
    avgCallSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    phoneBookings: phoneOrders.length,
    phoneBaskets: phoneOrders.filter((o) => o.kind === "basket").length,
    paidRate: phoneOrders.length ? Math.round((paid.length / phoneOrders.length) * 100) : null,
    paidAfterReminder: remindedThenPaid.length,
    phoneRevenueInr: Math.round(paid.reduce((s, o) => s + o.total, 0) * INR_PER_USD),
    phoneClaims: db.orders.reduce((n, o) => n + o.complaints.filter((c) => c.channel === "phone").length, 0),
    sms: (db.smsLog ?? []).length,
    openCallbacks: (db.callbacks ?? []).filter((c) => c.status === "open").length,
  };
}
