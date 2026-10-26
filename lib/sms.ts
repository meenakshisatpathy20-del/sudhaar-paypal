import crypto from "node:crypto";
import { readDB, updateDB } from "./db";
import { INR_PER_USD } from "./pricing";
import { slotLabel } from "./slots";
import type { Order, SmsMessage } from "./types";
import { warrantyDays } from "./warranty";

// SMS for people without a smartphone (and everyone else): the PayPal pay link goes to the payer,
// pickup and delivery OTPs go to the customer's registered number, and price changes and claim
// decisions are texted with a link. Without an SMS provider configured, every message is still
// written to the SMS log in the admin console and marked "simulated", so the flow can be demoed.
//
// Provider: Twilio's Messages API (SMS_PROVIDER=twilio). Note that SMS to Indian numbers is subject
// to TRAI DLT rules; a Twilio trial account can only text numbers verified in Twilio.

const now = () => new Date().toISOString();
const rid = () => crypto.randomBytes(4).toString("hex");
export const maskPhone = (p: string) => `••••••${p.slice(-4)}`;
const rupees = (usd: number) => `₹${Math.round(usd * INR_PER_USD)}`;
const site = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

export function smsProvider() {
  const twilio = process.env.SMS_PROVIDER === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID);
  return twilio ? "twilio" : "log";
}

/** Demo accounts have made-up numbers: never text them. */
function isDemoNumber(phone: string) {
  return readDB().accounts.some((a) => a.demo && a.phone === phone);
}

async function twilioSend(phone: string, text: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const base = (process.env.SMS_API_BASE ?? "https://api.twilio.com").replace(/\/$/, "");
  const form = new URLSearchParams({ To: `+91${phone}`, Body: text });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM!);
  const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok) throw new Error(json.message ?? `Twilio answered ${res.status}`);
  return json.sid;
}

/**
 * Send one SMS and log it. Never throws: a failed text must not break a booking or a payment.
 * `secret` (an OTP) is masked in the log so the admin console never stores it in plain text.
 */
export async function sendSms(phone: string | undefined, kind: string, text: string, opts: { orderId?: string; secret?: string; accountId?: string } = {}): Promise<SmsMessage | null> {
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) return null;
  const msg: SmsMessage = {
    id: rid(),
    at: now(),
    to: maskPhone(phone),
    kind,
    orderId: opts.orderId,
    accountId: opts.accountId ?? readDB().accounts.find((a) => a.phone === phone)?.id,
    text: opts.secret ? text.replaceAll(opts.secret, "••••") : text,
    status: "simulated",
    provider: smsProvider(),
  };
  if (msg.provider === "twilio" && !isDemoNumber(phone)) {
    try {
      msg.ref = await twilioSend(phone, text);
      msg.status = "sent";
    } catch (e) {
      msg.status = "failed";
      msg.error = (e as Error).message.slice(0, 200);
    }
  } else if (isDemoNumber(phone)) msg.error = "demo number, not texted";
  await updateDB((db) => {
    db.smsLog ??= [];
    db.smsLog.unshift(msg);
    if (db.smsLog.length > 300) db.smsLog.length = 300;
  });
  return msg;
}

// ---------- What each event texts ----------

export type SmsEvent = "booked_phone" | "paid" | "delivery_otp" | "delivered" | "price_change" | "claim_waiting" | "claim_decided" | "otp_resend" | "pay_reminder" | "expired" | "pickup_soon" | "re_repair";

function customerPhone(o: Order) {
  return readDB().accounts.find((a) => a.id === o.customerId && a.role === "customer")?.phone;
}

/** Phone customers get Hindi; website customers get English. */
const hindi = (o: Order) => o.bookedBy === "phone" || Boolean(readDB().accounts.find((a) => a.id === o.customerId)?.viaPhone);

export const payLink = (o: Order) => (o.familyPay?.token ? `${site()}/pay/${o.id}?t=${o.familyPay.token}` : `${site()}/orders/${o.id}`);
const trackLink = (o: Order) => (o.trackToken ? `${site()}/track/${o.id}?t=${o.trackToken}` : `${site()}/orders/${o.id}`);

/** Which OTP the customer needs right now, if any. */
export function currentOtp(o: Order): { which: "pickup" | "delivery"; otp: string } | null {
  if (o.status === "authorized") return { which: "pickup", otp: o.pickupOtp };
  if (o.status === "out_for_delivery" || (o.mode === "home-visit" && ["repairing", "repaired"].includes(o.status))) return { which: "delivery", otp: o.deliveryOtp };
  return null;
}

/** Text everyone an order event concerns. Safe to call from anywhere; it never throws. */
export async function notifyOrder(orderId: string, event: SmsEvent, extra: { claimId?: string; status?: string } = {}) {
  try {
    const o = readDB().orders.find((x) => x.id === orderId);
    if (!o) return [];
    const hi = hindi(o);
    const cust = customerPhone(o);
    const payer = o.familyPay?.phone;
    const who = o.customer.name.split(" ")[0];
    const item = o.kind === "basket" && o.jobs ? `${o.jobs.length} items` : o.item;
    const out: Promise<SmsMessage | null>[] = [];
    const send = (to: string | undefined, text: string, secret?: string) => out.push(sendSms(to, event, `Sudhaar: ${text}`, { orderId, secret }));
    const partner = (to: string, accountId: string, text: string) => out.push(sendSms(to, "partner_job", `Sudhaar: ${text}`, { orderId, accountId }));

    switch (event) {
      case "booked_phone": {
        const to = payer ?? cust;
        const forSelf = !payer || payer === cust;
        send(
          to,
          hi
            ? `${forSelf ? "आपकी" : `${who} की`} ${item} मरम्मत बुक हुई, कुल ${rupees(o.total)}। PayPal से भुगतान करें (पैसा सिर्फ़ होल्ड होगा, ठीक होकर लौटने पर कटेगा): ${payLink(o)}`
            : `${forSelf ? "Your" : `${who}'s`} ${item} repair is booked, total ${rupees(o.total)}. Pay with PayPal (held, taken only after it's back repaired): ${payLink(o)}`,
        );
        if (!forSelf) send(cust, hi ? `बुकिंग ${o.id} हो गई। भुगतान का लिंक ${o.familyPay?.name} को SMS से भेजा गया है।` : `Booking ${o.id} done. The payment link was texted to ${o.familyPay?.name}.`);
        break;
      }
      case "paid": {
        const slot = o.pickupSlot ? slotLabel(o.pickupSlot, hi ? "hi-IN" : "en-IN", hi ? { today: "आज", tomorrow: "कल" } : { today: "today", tomorrow: "tomorrow" }) : "";
        const otp = o.pickupOtp;
        if (o.mode === "pickup")
          send(cust, hi ? `भुगतान होल्ड हुआ। साथी ${slot} आएगा। पिकअप OTP ${otp} सिर्फ़ साथी को सामान देते समय बताएं। ट्रैक: ${trackLink(o)}` : `Payment held. Your Repair Saathi comes ${slot}. Pickup OTP ${otp}: tell it only at handover. Track: ${trackLink(o)}`, otp);
        else send(cust, hi ? `भुगतान होल्ड हुआ। कारीगर ${slot} आएंगे। आने पर OTP ${otp} बताएं।` : `Payment held. The karigar visits ${slot}. Arrival OTP ${otp}: tell it when they arrive.`, otp);
        if (payer && payer !== cust) send(payer, hi ? `धन्यवाद! ${who} की ${item} मरम्मत का भुगतान PayPal में होल्ड है। ट्रैक: ${trackLink(o)}` : `Thank you! Payment for ${who}'s ${item} repair is held by PayPal. Track: ${trackLink(o)}`);
        // The karigar and the Saathi often don't watch an app either: they get the job by SMS.
        const db = readDB();
        const k = db.accounts.find((a) => a.role === "karigar" && a.karigarId === o.karigarId);
        const sa = o.mode === "pickup" ? db.accounts.find((a) => a.role === "saathi" && a.saathiId === o.saathiId) : undefined;
        if (k) partner(k.phone, k.id, `नया काम ${o.id}: ${item} (${o.issue.slice(0, 60)}), आपको ${rupees(o.split.karigar)} मिलेंगे। ${o.mode === "pickup" ? `साथी ${slot} पिकअप करके लाएगा।` : `ग्राहक के घर ${slot} जाना है।`}`);
        if (sa) partner(sa.phone, sa.id, `नई पिकअप ${o.id}: ${item}, ${o.customer.address || who}, ${slot}। OTP ग्राहक से लें। कमाई ${rupees(o.split.saathi)}।`);
        break;
      }
      case "delivery_otp": {
        const otp = o.deliveryOtp;
        send(cust, hi ? `${item} ठीक होकर आ रहा है। सामान जाँचकर ही डिलीवरी OTP ${otp} बताएं।` : `Your ${item} is on its way back. Check it, then give delivery OTP ${otp}.`, otp);
        break;
      }
      case "delivered": {
        const days = warrantyDays(o);
        send(cust, hi ? `${item} डिलीवर हुआ, PayPal से ${rupees(o.total)} लिए गए। ${days} दिन की वारंटी है: कोई समस्या हो तो Sudhaar को फ़ोन करें या ${site()}/resolve` : `${item} delivered; PayPal took ${rupees(o.total)}. ${days}-day warranty: call Sudhaar or visit ${site()}/resolve if anything's wrong.`);
        break;
      }
      case "price_change": {
        const pc = o.priceChange;
        if (!pc) break;
        const text = hi
          ? `कारीगर ने जाँच के बाद ${pc.item} का दाम ${rupees(pc.from)} से ${rupees(pc.to)} बताया: "${pc.reason}". हाँ/ना यहाँ चुनें: ${payLink(o)}`
          : `After inspection the karigar asks to change ${pc.item} from ${rupees(pc.from)} to ${rupees(pc.to)}: "${pc.reason}". Approve or decline: ${payLink(o)}`;
        send(cust, text);
        if (payer && payer !== cust) send(payer, text);
        break;
      }
      case "claim_waiting":
        send(cust, hi ? `दावा ${extra.claimId}: Sudhaar टीम ने आपसे एक सवाल पूछा है। Sudhaar को फ़ोन करें या देखें ${site()}/resolve/${extra.claimId}` : `Claim ${extra.claimId}: the Sudhaar team has a question for you. Reply at ${site()}/resolve/${extra.claimId}`);
        break;
      case "claim_decided": {
        const c = o.complaints.find((x) => x.id === extra.claimId);
        const r = c?.resolution;
        const what = !r
          ? hi ? "बंद" : "closed"
          : r.action === "refund"
            ? hi ? `${rupees(r.amount ?? 0)} PayPal में रिफ़ंड` : `${rupees(r.amount ?? 0)} refunded to PayPal`
            : r.action === "re_repair"
              ? hi ? "मुफ़्त दोबारा मरम्मत; साथी सामान फिर लेने आएगा" : "free re-repair; a Saathi will collect the item again"
              : hi ? "रिफ़ंड नहीं" : "no refund";
        send(cust, hi ? `दावा ${extra.claimId} का फ़ैसला: ${what}। ${r?.remarks ?? ""}`.trim() : `Claim ${extra.claimId} decided: ${what}. ${r?.remarks ?? ""}`.trim());
        break;
      }
      case "pay_reminder": {
        if (!payer) break;
        send(payer, hi ? `याद दिलाना: ${who} की ${item} मरम्मत (${rupees(o.total)}) का भुगतान बाकी है। PayPal से होल्ड करें: ${payLink(o)}` : `Reminder: ${who}'s ${item} repair (${rupees(o.total)}) is waiting for payment. Hold it with PayPal: ${payLink(o)}`);
        break;
      }
      case "expired": {
        const text = hi ? `${item} की बुकिंग ${o.id} समय पर भुगतान न होने से रद्द हो गई। कोई पैसा नहीं कटा। दोबारा बुक करने के लिए Sudhaar को फ़ोन करें।` : `Booking ${o.id} for ${item} was released because it wasn't paid in time. Nothing was charged. Call Sudhaar to book again.`;
        send(cust, text);
        if (payer && payer !== cust) send(payer, text);
        break;
      }
      case "pickup_soon": {
        const slot = o.pickupSlot ? slotLabel(o.pickupSlot, hi ? "hi-IN" : "en-IN", hi ? { today: "आज", tomorrow: "कल" } : { today: "today", tomorrow: "tomorrow" }) : "";
        send(cust, hi ? `${o.mode === "pickup" ? "Repair Saathi" : "कारीगर"} ${slot} आ रहे हैं (${item})। OTP पिछले SMS में है; न मिले तो Sudhaar को फ़ोन करें।` : `Your ${o.mode === "pickup" ? "Repair Saathi" : "karigar"} comes ${slot} for the ${item}. Your OTP is in the earlier SMS.`);
        break;
      }
      case "re_repair": {
        const slot = o.pickupSlot ? slotLabel(o.pickupSlot, hi ? "hi-IN" : "en-IN", hi ? { today: "आज", tomorrow: "कल" } : { today: "today", tomorrow: "tomorrow" }) : "";
        const otp = o.pickupOtp;
        send(cust, hi ? `मुफ़्त दोबारा मरम्मत बुक हुई (${o.id}), कोई पैसा नहीं लगेगा। साथी ${slot} आएगा। पिकअप OTP ${otp}।` : `Free re-repair booked (${o.id}), nothing to pay. A Saathi comes ${slot}. Pickup OTP ${otp}.`, otp);
        const db = readDB();
        const k = db.accounts.find((a) => a.role === "karigar" && a.karigarId === o.karigarId);
        if (k) partner(k.phone, k.id, `वारंटी काम ${o.id}: ${item} फिर से ठीक करना है (${o.issue.slice(0, 60)})। साथी ${slot} लाएगा।`);
        break;
      }
      case "otp_resend": {
        const cur = currentOtp(o);
        if (!cur) break;
        send(
          cust,
          hi ? `${cur.which === "pickup" ? "पिकअप" : "डिलीवरी"} OTP ${cur.otp} है (${o.id})। इसे सिर्फ़ साथी/कारीगर को सामने बताएं।` : `${cur.which === "pickup" ? "Pickup" : "Delivery"} OTP for ${o.id}: ${cur.otp}. Tell it only in person.`,
          cur.otp,
        );
        break;
      }
    }
    return (await Promise.all(out)).filter(Boolean) as SmsMessage[];
  } catch {
    return [];
  }
}

/** OTP re-sends are limited: 3 per order per 30 minutes. */
export async function resendOtp(orderId: string) {
  const recent = (readDB().smsLog ?? []).filter((m) => m.orderId === orderId && m.kind === "otp_resend" && Date.now() - Date.parse(m.at) < 30 * 60_000);
  if (recent.length >= 3) return { ok: false as const, reason: "too_many" };
  const o = readDB().orders.find((x) => x.id === orderId);
  if (!o || !currentOtp(o)) return { ok: false as const, reason: "no_otp_now" };
  if (!customerPhone(o)) return { ok: false as const, reason: "no_phone" };
  const sent = await notifyOrder(orderId, "otp_resend");
  return { ok: true as const, to: sent[0]?.to, status: sent[0]?.status };
}
