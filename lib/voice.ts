import crypto from "node:crypto";
import { normalisePhone } from "./auth";
import { config } from "./config";
import { readDB, updateDB } from "./db";
import { actOnSystemClaim, notify } from "./claims";
import { isOpenClaim } from "./claims-shared";
import { advance, createBasketOrder, createOrder, createQuote, FlowError, offersFor, raiseComplaint } from "./orders";
import { maskPhone, notifyOrder, payLink, resendOtp, sendSms } from "./sms";
import { geocodeAddress } from "./geocode";
import { hashPin } from "./pin";
import { INR_PER_USD, serviceModeFor } from "./pricing";
import { pickupSlots, slotLabel } from "./slots";
import type { Account, Category, Complaint, Order } from "./types";
import { warrantyDaysLeft } from "./warranty";

// The Bolna phone line: a Hindi voice agent on Bolna calls these functions (Bolna "custom functions")
// while it talks to the caller. The caller's own number (Bolna's from_number) identifies them, so
// someone without a smartphone can get a quote, book a pickup, check a repair or raise a claim.
// Payment still happens in PayPal: the booking creates a Family Pay link that the caller's family (or
// the caller, on any phone with a browser) approves. The phone agent can never take money itself.

/** Every voice endpoint needs VOICE_API_TOKEN, sent by Bolna as a Bearer token (or ?token=). */
export function requireVoiceToken(req: Request) {
  const expected = (process.env.VOICE_API_TOKEN ?? "").trim();
  if (!expected) throw new FlowError("The phone line isn't set up on this server (VOICE_API_TOKEN).", 503);
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const given = auth || req.headers.get("x-voice-token")?.trim() || new URL(req.url).searchParams.get("token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new FlowError("Not allowed", 401);
}

/** Bolna can call a function with GET (values in the query) or POST (a JSON body); accept both. */
export async function voiceInput(req: Request): Promise<Record<string, unknown>> {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  delete q.token;
  const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  return { ...q, ...body };
}

/** Bolna sends numbers in E.164 (+919876543210); accounts store 10 digits. */
export function callerPhone(raw: unknown): string {
  const phone = normalisePhone(typeof raw === "number" ? String(raw) : raw);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new FlowError("I couldn't read the caller's mobile number.");
  return phone;
}

export const inr = (usd: number) => Math.round(usd * INR_PER_USD);
const firstName = (n: string) => n.split(" ")[0];

export function findCustomer(phone: string): Account | undefined {
  return readDB().accounts.find((a) => a.role === "customer" && a.phone === phone);
}

/** The caller's account, created on first booking. A new PIN is returned once so they can use the website too. */
async function customerForCall(phone: string, name: string, address: string): Promise<{ account: Account; newPin?: string }> {
  const existing = findCustomer(phone);
  // A spoken address becomes a real map point, so distances, pickup fees and the Saathi's map are right.
  const spot = address ? await geocodeAddress(address) : null;
  if (existing) {
    // Phone customers move with the address they give; a website customer's saved address is kept.
    if (address && (existing.viaPhone ? address !== existing.address : !existing.address))
      await updateDB((db) => {
        const a = db.accounts.find((x) => x.id === existing.id)!;
        a.address = address;
        if (spot && existing.viaPhone) Object.assign(a, { lat: spot.lat, lng: spot.lng });
      });
    return { account: findCustomer(phone) ?? existing };
  }
  if (readDB().accounts.some((a) => a.phone === phone)) throw new FlowError("This number belongs to a partner account. Please call from your own number.");
  const pin = String(crypto.randomInt(1000, 10000));
  const account: Account = {
    id: `C-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    role: "customer",
    name: name.trim().slice(0, 60) || "Phone customer",
    phone,
    pinHash: hashPin(pin),
    createdAt: new Date().toISOString(),
    address: address.trim().slice(0, 120) || undefined,
    lat: spot?.lat ?? config.demoCenter.lat,
    lng: spot?.lng ?? config.demoCenter.lng,
    viaPhone: true,
  };
  await updateDB((db) => void db.accounts.push(account));
  return { account, newPin: pin };
}

const STATUS_HI: Partial<Record<Order["status"], string>> = {
  awaiting_payment: "भुगतान का इंतज़ार है",
  authorized: "बुक है, साथी पिकअप के लिए आएगा",
  picked_up: "साथी ने सामान ले लिया है",
  at_karigar: "सामान कारीगर के पास है",
  repairing: "मरम्मत चल रही है",
  repaired: "मरम्मत हो गई है, साथी वापस लाएगा",
  out_for_delivery: "सामान डिलीवरी के लिए निकल चुका है",
  delivered: "डिलीवर हो गया",
  paid_out: "पूरा हो गया",
  cancelled: "रद्द हो गया",
};

const slotHi = (slot: { start: string; end: string }) => slotLabel(slot, "hi-IN", { today: "आज", tomorrow: "कल" });

/** Inbound caller lookup: Bolna adds this to the agent's prompt before it says hello. */
export function callerContext(rawPhone: unknown) {
  // Outbound-call variables are blank on an incoming call, so the prompt can tell the two apart.
  const blank = { call_reason: "incoming", order_id: "", item: "", customer_name: "", payer_name: "", total_inr: "", pickup_time: "", care_member: false };
  let phone: string;
  try {
    phone = callerPhone(rawPhone);
  } catch {
    return { ...blank, known_customer: false, caller_name: "", active_repairs: 0, summary: "Unknown number." };
  }
  const a = findCustomer(phone);
  if (!a) return { ...blank, known_customer: false, caller_name: "", active_repairs: 0, summary: "New caller: no Sudhaar account yet." };
  const active = readDB().orders.filter((o) => o.customerId === a.id && !["paid_out", "cancelled"].includes(o.status));
  return {
    ...blank,
    known_customer: true,
    caller_name: firstName(a.name),
    care_member: a.care?.status === "ACTIVE",
    active_repairs: active.length,
    summary: active.length ? active.map((o) => `${o.item}: ${STATUS_HI[o.status] ?? o.status}`).join("; ") : "No active repairs.",
  };
}

/** Quote by voice: the item, a fair repair range, the best karigars and the next pickup times. */
export async function voiceQuote(input: { description?: unknown; category?: unknown; phone?: unknown }) {
  const description = String(input.description ?? "").trim().slice(0, 300);
  if (description.length < 3) throw new FlowError("Ask the caller what is broken.");
  const category = typeof input.category === "string" && input.category ? (input.category as Category) : undefined;
  const quote = await createQuote({ description, category });
  let at = { lat: config.demoCenter.lat, lng: config.demoCenter.lng };
  try {
    const a = findCustomer(callerPhone(input.phone));
    if (a?.lat !== undefined && a.lng !== undefined) at = { lat: a.lat, lng: a.lng };
  } catch {}
  const offers = offersFor(quote, at).slice(0, 3);
  const slots = pickupSlots().slice(0, 4);
  return {
    quote_id: quote.id,
    item: quote.item,
    issue: quote.issue,
    repairable: quote.repairable,
    repair_range_inr: `${inr(quote.repairLow)} to ${inr(quote.repairHigh)}`,
    new_price_inr: inr(quote.newPrice),
    home_visit: serviceModeFor(quote.category) === "home-visit",
    can_add_to_basket: serviceModeFor(quote.category) === "pickup",
    karigars: offers.map((o) => ({
      karigar_id: o.karigar.id,
      shop: o.karigar.shop,
      repair_inr: inr(o.price),
      pickup_inr: inr(o.pickupFee),
      total_inr: inr(o.price) + inr(o.pickupFee),
      distance_km: o.distanceKm,
      ready_in_days: o.readyInDays,
      rating: o.karigar.rating,
    })),
    pickup_slots: slots.map((s, i) => ({ slot_index: i, label: slotHi(s) })),
    say: quote.repairable
      ? `${quote.item} की मरम्मत लगभग ${inr(quote.repairLow)} से ${inr(quote.repairHigh)} रुपये में होगी, नया लेने में लगभग ${inr(quote.newPrice)} रुपये लगते। सबसे अच्छे कारीगर ${offers[0]?.karigar.shop ?? ""} हैं, कुल ${offers[0] ? inr(offers[0].price) + inr(offers[0].pickupFee) : ""} रुपये, पिकअप और डिलीवरी मिलाकर।`
      : `${quote.item} की मरम्मत फ़ायदेमंद नहीं लगती।`,
  };
}

/**
 * Books by voice. The order is paid with PayPal through a Family Pay link: the caller's son or
 * daughter (or the caller on any browser) opens it and approves. Until then nothing is charged.
 */
export async function voiceBook(input: { phone?: unknown; name?: unknown; address?: unknown; quote_id?: unknown; quote_ids?: unknown; karigar_id?: unknown; slot_index?: unknown; payer_name?: unknown; payer_relation?: unknown; payer_phone?: unknown }) {
  const phone = callerPhone(input.phone);
  // Ghar Safai by phone: several quoted items picked up together, one fee, one PayPal payment.
  const many = [...new Set((Array.isArray(input.quote_ids) ? input.quote_ids : String(input.quote_ids ?? "").split(/[\s,]+/)).map((x) => String(x).trim()).filter(Boolean))];
  const quoteIds = many.length > 1 ? many : [String(input.quote_id ?? many[0] ?? "")];
  const basket = quoteIds.length > 1;
  const quotes = quoteIds.map((id) => readDB().quotes.find((q) => q.id === id));
  if (quotes.some((q) => !q)) throw new FlowError("Get a quote first (a quote_id is missing or wrong).");
  if (basket && quoteIds.length > 6) throw new FlowError("Book at most 6 items in one phone basket.");
  if (basket) {
    const visit = quotes.find((q) => serviceModeFor(q!.category) !== "pickup");
    if (visit) throw new FlowError(`"${visit.item}" needs a karigar to come home, so book it separately from the basket.`);
  }
  const name = String(input.name ?? "").trim();
  const address = String(input.address ?? "").trim();
  // Check everything before creating an account, so a failed attempt never leaves an account whose PIN nobody heard.
  if (!address && !findCustomer(phone)?.address) throw new FlowError("Ask the caller for their address for the pickup.");
  if (!findCustomer(phone) && name.length < 2) throw new FlowError("Ask the caller for their name.");
  if (!basket && !offersForCheck(phone, quoteIds[0], String(input.karigar_id ?? ""))) throw new FlowError("That karigar can't take this job. Use a karigar_id from the quote.");
  const payer = String(input.payer_name ?? "").trim();
  // The PayPal link is texted to whoever pays: the family member's number, or the caller's own.
  const rawPayerPhone = String(input.payer_phone ?? "").trim();
  const payerPhone = rawPayerPhone ? normalisePhone(rawPayerPhone) : "";
  if (payer && !rawPayerPhone) throw new FlowError(`Ask for ${payer}'s mobile number, so the payment link can be sent by SMS.`);
  if (rawPayerPhone && !/^[6-9]\d{9}$/.test(payerPhone)) throw new FlowError("That mobile number doesn't look right. Ask for the 10-digit number again.");
  const { account, newPin } = await customerForCall(phone, name, address);
  const customer = findCustomer(phone) ?? account;
  const slots = pickupSlots();
  const idx = Math.min(Math.max(0, Number(input.slot_index) || 0), slots.length - 1);
  const familyPay = { name: payer || firstName(account.name), relation: String(input.payer_relation ?? "").trim() || (payer ? "family" : "self"), phone: payerPhone || phone };
  const at = customer.lat !== undefined && customer.lng !== undefined ? { lat: customer.lat, lng: customer.lng } : { lat: config.demoCenter.lat, lng: config.demoCenter.lng };
  const order = basket
    ? await createBasketOrder({
        customer,
        // Each item goes to its best karigar for that job, as on the website's Ghar Safai page.
        items: quotes.map((q) => ({ quoteId: q!.id, karigarId: offersFor(q!, at)[0]?.karigar.id ?? "" })),
        bookedBy: "phone",
        pickupSlot: slots[idx],
        familyPay,
      })
    : await createOrder({ customer, quoteId: quoteIds[0], karigarId: String(input.karigar_id ?? ""), bookedBy: "phone", pickupSlot: slots[idx], familyPay });
  const texts = await notifyOrder(order.id, "booked_phone");
  const linkTo = maskPhone(payerPhone || phone);
  const total = Math.round(order.total * INR_PER_USD);
  return {
    order_id: order.id,
    basket,
    items: basket ? order.jobs?.map((j) => j.item) : [order.item],
    pickup_fee_inr: Math.round(order.pickupFee * INR_PER_USD),
    total_inr: total,
    pickup: order.pickupSlot ? slotHi(order.pickupSlot) : "",
    pay_link: payLink(order),
    pay_link_sms: { to: linkTo, status: texts[0]?.status ?? "not_sent" },
    new_account_pin: newPin ?? null,
    say: `${basket ? `आपकी घर सफ़ाई टोकरी बुक हो गई है: ${order.jobs?.length} चीज़ें, एक ही पिकअप।` : "आपकी बुकिंग हो गई है।"} नंबर ${order.id.split("").join(" ")}. कुल ${total} रुपये। भुगतान PayPal से होगा और पैसा तभी कटेगा जब सामान ठीक होकर आपके पास वापस आएगा। भुगतान का लिंक ${payer ? `${payer} के नंबर` : "आपके नंबर"} पर SMS से भेज दिया है, जो ${linkTo.slice(-4).split("").join(" ")} पर ख़त्म होता है। पैसा जमा होते ही पिकअप का OTP आपको SMS से मिलेगा।${newPin ? ` आपका Sudhaar PIN ${newPin.split("").join(" ")} है, इसे अपने नंबर के साथ वेबसाइट पर इस्तेमाल कर सकते हैं।` : ""}`,
  };
}

/** Is this karigar one of the offers for the quote (checked before any account is created)? */
function offersForCheck(phone: string, quoteId: string, karigarId: string) {
  const quote = readDB().quotes.find((q) => q.id === quoteId);
  const a = findCustomer(phone);
  const at = a?.lat !== undefined && a.lng !== undefined ? { lat: a.lat, lng: a.lng } : { lat: config.demoCenter.lat, lng: config.demoCenter.lng };
  return Boolean(quote && offersFor(quote, at).some((o) => o.karigar.id === karigarId));
}

function callerOrders(phone: string) {
  const a = findCustomer(phone);
  if (!a) return [];
  return readDB().orders.filter((o) => o.customerId === a.id && o.status !== "cancelled");
}

/** Where are my repairs? OTPs are never read out on the phone (caller ID can be faked). */
export function voiceStatus(input: { phone?: unknown }) {
  const phone = callerPhone(input.phone);
  const orders = callerOrders(phone).slice(0, 3);
  if (!orders.length) return { orders: [], say: "इस नंबर पर कोई मरम्मत नहीं मिली।" };
  // Open Resolve Hub claims, with the team's latest question, so a phone customer can follow them too.
  const claims = orders.flatMap((o) =>
    o.complaints.filter(isOpenClaim).map((c) => {
      const lastTeam = [...(c.thread ?? [])].reverse().find((m) => m.by === "admin" && !m.internal);
      return { order_id: o.id, claim_id: c.id, status: c.status ?? "open", waiting_for_you: c.status === "awaiting_customer", team_question: lastTeam?.text ?? null };
    }),
  );
  const claimSay = claims
    .map((c) => (c.waiting_for_you ? `आपकी शिकायत ${c.claim_id} पर टीम का सवाल है: ${c.team_question ?? ""}` : `आपकी शिकायत ${c.claim_id} की जाँच चल रही है`))
    .join("। ");
  return {
    orders: orders.map((o) => ({ order_id: o.id, item: o.item, status: o.status, status_hi: STATUS_HI[o.status] ?? o.status, pickup: o.pickupSlot ? slotHi(o.pickupSlot) : "", total_inr: Math.round(o.total * INR_PER_USD), payment_pending: o.status === "awaiting_payment" })),
    claims,
    say: [orders.map((o) => `${o.item}: ${STATUS_HI[o.status] ?? o.status}${o.status === "authorized" && o.pickupSlot ? `, पिकअप ${slotHi(o.pickupSlot)}` : ""}`).join("। "), claimSay].filter(Boolean).join("। "),
  };
}

/** Cancel before pickup: PayPal releases the hold (or the unpaid booking is dropped). */
export async function voiceCancel(input: { phone?: unknown; order_id?: unknown }) {
  const phone = callerPhone(input.phone);
  const o = callerOrders(phone).find((x) => x.id === String(input.order_id ?? "").trim().toUpperCase()) ?? callerOrders(phone).find((x) => ["awaiting_payment", "authorized"].includes(x.status));
  if (!o) throw new FlowError("No booking that can still be cancelled on this number.");
  if (!["awaiting_payment", "authorized"].includes(o.status)) throw new FlowError("This repair has already been picked up, so it can't be cancelled now.");
  await advance(o.id, "cancel");
  return { order_id: o.id, cancelled: true, say: `${o.item} की बुकिंग रद्द हो गई। कोई पैसा नहीं कटा।` };
}

const ISSUES: Complaint["issue"][] = ["repair_failed", "damaged", "overcharged", "delayed", "missing"];

/** Warranty claim by voice: goes to Resolve Hub, where Gemini reviews it and a person decides. */
export async function voiceComplaint(input: { phone?: unknown; order_id?: unknown; issue?: unknown; details?: unknown }) {
  const phone = callerPhone(input.phone);
  const all = callerOrders(phone).filter((o) => o.paypal.captureId && warrantyDaysLeft(o) >= 0);
  const o = all.find((x) => x.id === String(input.order_id ?? "").trim().toUpperCase()) ?? all[0];
  if (!o) throw new FlowError("No delivered repair under warranty on this number.");
  const details = String(input.details ?? "").slice(0, 900);
  // Calling again about the same repair adds to the open claim instead of failing.
  const open = o.complaints.find(isOpenClaim);
  if (open) {
    await actOnSystemClaim(open.id, phone, details);
    return { order_id: o.id, claim_id: open.id, added_to_existing: true, say: `आपकी बात शिकायत ${open.id.split("").join(" ")} में जोड़ दी है। टीम जल्दी जवाब देगी।` };
  }
  const issue = ISSUES.includes(input.issue as Complaint["issue"]) ? (input.issue as Complaint["issue"]) : "repair_failed";
  const updated = await raiseComplaint(o.id, { issue, details, channel: "phone" });
  const ai = updated.complaints[0]?.ai;
  return {
    order_id: o.id,
    claim_id: updated.complaints[0]?.id,
    ai_recommendation: ai?.recommendation ?? null,
    say: `आपकी शिकायत Resolve Hub में दर्ज हो गई है। हमारी टीम जाँच करके जल्दी फ़ैसला करेगी${ai?.recommendation === "re_repair" ? ", शायद कारीगर मुफ़्त में दोबारा ठीक करेंगे" : ai?.refundAmount ? ", और रिफ़ंड PayPal से वापस जाएगा" : ""}।`,
  };
}

/**
 * "I forgot my OTP": the OTP is never read out on the call (caller ID can be faked), but it can be
 * texted to the number registered on the order, which only the real customer receives.
 */
export async function voiceSendOtp(input: { phone?: unknown; order_id?: unknown }) {
  const phone = callerPhone(input.phone);
  const orders = callerOrders(phone);
  const o =
    orders.find((x) => x.id === String(input.order_id ?? "").trim().toUpperCase()) ??
    orders.find((x) => ["authorized", "out_for_delivery", "repaired", "repairing"].includes(x.status)) ??
    orders.find((x) => x.status === "awaiting_payment");
  if (!o) throw new FlowError("No repair on this number needs an OTP or a payment right now.");
  // Not paid yet: there is no OTP. "My son didn't get the link" — text the PayPal link to the payer again.
  if (o.status === "awaiting_payment") {
    const recent = (readDB().smsLog ?? []).filter((m) => m.orderId === o.id && m.kind === "pay_reminder" && Date.now() - Date.parse(m.at) < 30 * 60_000);
    if (recent.length >= 2) throw new FlowError("The payment link was already sent twice in the last 30 minutes. Ask them to check their messages.");
    const sent = await notifyOrder(o.id, "pay_reminder");
    return { order_id: o.id, payment_pending: true, sent_to: sent[0]?.to, say: `अभी भुगतान बाकी है, इसलिए OTP नहीं बना। मैंने PayPal का लिंक ${o.familyPay?.name ?? ""} के नंबर पर फिर से भेज दिया है।` };
  }
  const r = await resendOtp(o.id);
  if (!r.ok) {
    if (r.reason === "too_many") throw new FlowError("The OTP was already sent 3 times in the last 30 minutes. Ask them to check their messages.");
    throw new FlowError("This repair doesn't need an OTP right now.");
  }
  return { order_id: o.id, sent_to: r.to, say: `OTP आपके रजिस्टर्ड नंबर पर SMS से भेज दिया है। इसे सिर्फ़ साथी या कारीगर को सामने बताइए।` };
}

/**
 * "I want to talk to a person": the agent can't solve everything. The request goes to the admin
 * console (and the team's notification bell), and the caller gets an SMS that someone will call.
 * With a team phone number set up in Bolna's Transfer Call tool, urgent calls can also be transferred live.
 */
export async function voiceCallback(input: { phone?: unknown; reason?: unknown; order_id?: unknown }) {
  const phone = callerPhone(input.phone);
  const reason = String(input.reason ?? "").trim().slice(0, 300) || "Caller asked to speak to a person.";
  const a = findCustomer(phone);
  const orderId = String(input.order_id ?? "").trim().toUpperCase() || callerOrders(phone)[0]?.id;
  const open = (readDB().callbacks ?? []).find((c) => c.phone === phone && c.status === "open");
  if (open) return { callback_id: open.id, already_requested: true, say: "आपका अनुरोध पहले से दर्ज है, Sudhaar टीम जल्द ही आपको फ़ोन करेगी।" };
  const id = `CB${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  await updateDB((db) => {
    db.callbacks ??= [];
    db.callbacks.unshift({ id, at: new Date().toISOString(), phone, name: a?.name, reason, orderId: orderId || undefined, customerId: a?.id, status: "open" });
    if (db.callbacks.length > 200) db.callbacks.length = 200;
    notify(db, db.accounts.filter((x) => x.role === "admin").map((x) => x.id), "nCallback", { name: a ? firstName(a.name) : maskPhone(phone) }, "/admin?tab=phone");
  });
  await sendSms(phone, "callback", `Sudhaar: ${a ? `${firstName(a.name)} जी, ` : ""}आपकी बात दर्ज हो गई है। Sudhaar टीम का एक व्यक्ति जल्द ही आपको फ़ोन करेगा।`, { accountId: a?.id });
  return { callback_id: id, say: "ठीक है, मैंने आपकी बात टीम को दे दी है। Sudhaar टीम का एक व्यक्ति जल्द ही आपको इसी नंबर पर फ़ोन करेगा।" };
}

/** Bolna's post-call webhook: keep a short log for the admin console. */
export async function logCall(body: Record<string, unknown>) {
  const pick = (...keys: string[]) => keys.map((k) => body[k]).find((v) => v !== undefined && v !== null && v !== "");
  const tel = (body.telephony_data ?? {}) as Record<string, unknown>;
  const id = String(pick("id", "execution_id", "call_sid") ?? crypto.randomUUID()).slice(0, 80);
  const transcript = String(pick("transcript") ?? "").slice(0, 4000);
  const orderIds = [...new Set(transcript.match(/SD[0-9A-F]{6}/g) ?? [])];
  return updateDB((db) => {
    db.voiceCalls ??= [];
    const existing = db.voiceCalls.find((c) => c.id === id);
    const call = existing ?? { id, at: new Date().toISOString() };
    call.from = String(pick("from_number", "user_number") ?? tel.from_number ?? call.from ?? "").slice(0, 20) || call.from;
    call.status = String(pick("status") ?? call.status ?? "").slice(0, 30) || call.status;
    const dur = Number(pick("conversation_duration", "duration") ?? tel.duration);
    if (Number.isFinite(dur) && dur > 0) call.durationSec = Math.round(dur);
    const summary = pick("summary");
    if (summary) call.summary = String(summary).slice(0, 600);
    if (transcript) call.transcript = transcript;
    if (orderIds.length) call.orderIds = orderIds;
    call.direction ??= "inbound";
    if (!call.customerId && call.from) {
      const digits = normalisePhone(call.from);
      call.customerId = db.accounts.find((a) => a.role === "customer" && a.phone === digits)?.id;
    }
    if (!existing) db.voiceCalls.unshift(call);
    if (db.voiceCalls.length > 100) db.voiceCalls.length = 100;
    return call;
  });
}
