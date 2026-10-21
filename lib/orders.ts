import crypto from "node:crypto";
import { checkCompletion, quoteItem, reviewComplaint } from "./ai";
import { config } from "./config";
import { readDB, updateDB } from "./db";
import {
  authorizeOrder,
  captureAuthorization,
  createAuthorizeOrder,
  createPaidInvoice,
  describePayPalError,
  paypalMode,
  refundCapture,
  sendPayouts,
  voidAuthorization,
} from "./paypal";
import { AVG_ITEM_KG, basketPickupFee, computeSplit, haversineKm, karigarPrice, pickupFee, round2, serviceModeFor } from "./pricing";
import type { Category, Complaint, FamilyPay, Job, Karigar, Order, OrderEvent, OrderStatus, Quote } from "./types";

export class FlowError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const id = (prefix: string) => `${prefix}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const otp = () => String(crypto.randomInt(1000, 10000));
const now = () => new Date().toISOString();

function log(order: Order, e: Omit<OrderEvent, "at">) {
  order.events.push({ at: now(), ...e });
  if (e.status) order.status = e.status;
}

export const DEMO_CUSTOMER = () => ({
  name: "Anita Sharma",
  email: config.paypal.customerEmail,
  address: "Flat 12, Lake View Apartments",
  lat: config.demoCenter.lat,
  lng: config.demoCenter.lng,
});

// ---------- Quotes ----------

export async function createQuote(input: { photo?: string; description?: string; category?: Category }): Promise<Quote & { warning?: string }> {
  const q = await quoteItem(input);
  const quote: Quote = {
    id: id("Q"),
    createdAt: now(),
    item: q.item,
    category: q.category,
    size: q.size,
    issue: q.issue,
    repairable: q.repairable,
    repairLow: q.repairLow,
    repairHigh: q.repairHigh,
    newPrice: q.newPrice,
    repairDays: q.repairDays,
    confidence: q.confidence,
    notes: q.notes,
    photo: input.photo,
    description: input.description,
    source: q.source,
  };
  await updateDB((db) => {
    db.quotes.push(quote);
  });
  return { ...quote, warning: q.warning };
}

export interface KarigarOffer {
  karigar: Karigar;
  distanceKm: number;
  price: number;
  pickupFee: number;
  total: number;
  readyInDays: number;
  score: number;
  best?: boolean;
}

/** Shiprocket-style comparison: every verified karigar with the skill, priced, with distance and ETA. */
export function offersFor(quote: Quote, at = DEMO_CUSTOMER()): KarigarOffer[] {
  const db = readDB();
  const mode = serviceModeFor(quote.category);
  const offers = db.karigars
    .filter((k) => k.verified && k.skills.includes(quote.category))
    .map((k) => {
      const distanceKm = haversineKm(at, k);
      const fee = pickupFee(distanceKm, quote.size, mode);
      if (fee === null) return null;
      const price = karigarPrice(quote.repairLow, quote.repairHigh, k);
      const readyInDays = Math.max(quote.repairDays, k.turnaroundDays);
      // Lower is better: cost, then distance and days, rewarded by rating.
      // New karigars have no rating yet: treat them as average (4.0) so they still get work.
      const rating = k.jobsDone > 0 ? k.rating : 4;
      const score = round2(price + fee + distanceKm * 0.15 + readyInDays * 0.5 - (rating - 4) * 2);
      return { karigar: k, distanceKm, price, pickupFee: fee, total: round2(price + fee), readyInDays, score };
    })
    .filter((o): o is KarigarOffer => o !== null)
    .sort((a, b) => a.score - b.score);
  if (offers[0]) offers[0].best = true;
  return offers;
}

// ---------- Booking + PayPal authorize ----------

export async function createOrder(input: {
  quoteId: string;
  karigarId: string;
  donation?: number;
  bookedBy?: "customer" | "agent";
  familyPay?: { name: string; relation: string; email?: string };
}): Promise<Order> {
  const db = readDB();
  const quote = db.quotes.find((q) => q.id === input.quoteId);
  if (!quote) throw new FlowError("Quote not found", 404);
  const offer = offersFor(quote).find((o) => o.karigar.id === input.karigarId);
  if (!offer) throw new FlowError("That karigar cannot take this job", 404);
  const donation = Math.min(5, Math.max(0, round2(input.donation ?? 0)));
  const split = computeSplit(offer.price, offer.pickupFee, donation);
  const mode = serviceModeFor(quote.category);
  const saathi = db.saathis[Math.floor(Math.random() * db.saathis.length)];
  const order: Order = {
    id: id("SD"),
    kind: "single",
    familyPay: cleanFamilyPay(input.familyPay),
    createdAt: now(),
    status: "awaiting_payment",
    quoteId: quote.id,
    item: quote.item,
    category: quote.category,
    size: quote.size,
    issue: quote.issue,
    mode,
    karigarId: offer.karigar.id,
    saathiId: saathi.id,
    customer: DEMO_CUSTOMER(),
    distanceKm: offer.distanceKm,
    repairCharge: offer.price,
    pickupFee: offer.pickupFee,
    donation,
    total: split.total,
    currency: "USD",
    split: { karigar: split.karigar, saathi: split.saathi, platform: split.platform, donation: split.donation },
    pickupOtp: otp(),
    deliveryOtp: otp(),
    paypal: { mode: paypalMode(), refunds: [] },
    beforePhoto: quote.photo,
    payouts: [],
    complaints: [],
    events: [],
    bookedBy: input.bookedBy ?? "customer",
  };
  log(order, {
    status: "awaiting_payment",
    actor: order.bookedBy,
    message: `Booked ${offer.karigar.shop} for "${quote.item}" at $${offer.price.toFixed(2)} + $${offer.pickupFee.toFixed(2)} ${mode === "pickup" ? "pickup" : "visit"} fee.`,
  });
  return finalizeNewOrder(order);
}

function cleanFamilyPay(fp?: { name: string; relation: string; email?: string }): FamilyPay | undefined {
  if (!fp?.name?.trim()) return undefined;
  return { name: fp.name.trim().slice(0, 60), relation: (fp.relation || "family").trim().slice(0, 30), email: fp.email?.trim().slice(0, 120) || undefined };
}

async function finalizeNewOrder(order: Order): Promise<Order> {
  if (order.familyPay) {
    log(order, { actor: "customer", message: `Family Pay: payment request sent to ${order.familyPay.name} (${order.familyPay.relation}). They can pay with PayPal from anywhere.` });
  }
  try {
    const pp = await createAuthorizeOrder(order);
    order.paypal.orderId = pp.id;
    log(order, { actor: "system", kind: "paypal", message: "PayPal order created with intent AUTHORIZE (money will be held, not taken).", ref: pp.id });
  } catch (e) {
    const d = describePayPalError(e);
    throw new FlowError(`Could not create the PayPal order: ${d.message}`, 502);
  }
  await updateDB((db) => {
    db.orders.unshift(order);
  });
  return order;
}

// ---------- Ghar Safai Mode: many items, one pickup, one PayPal payment ----------

export async function createBasketOrder(input: {
  items: { quoteId: string; karigarId: string }[];
  donation?: number;
  bookedBy?: "customer" | "agent";
  familyPay?: { name: string; relation: string; email?: string };
}): Promise<Order> {
  if (!input.items?.length) throw new FlowError("Add at least one item to the basket");
  if (input.items.length > 12) throw new FlowError("A basket can hold up to 12 items");
  const db = readDB();
  const jobs: Job[] = [];
  const fees: number[] = [];
  let farthest = 0;
  for (const it of input.items) {
    const quote = db.quotes.find((q) => q.id === it.quoteId);
    if (!quote) throw new FlowError("Quote not found", 404);
    if (serviceModeFor(quote.category) !== "pickup") throw new FlowError(`"${quote.item}" needs a home visit, so book it separately`);
    const offer = offersFor(quote).find((o) => o.karigar.id === it.karigarId);
    if (!offer) throw new FlowError(`No karigar available for "${quote.item}"`, 404);
    fees.push(offer.pickupFee);
    farthest = Math.max(farthest, offer.distanceKm);
    jobs.push({
      id: id("J"),
      quoteId: quote.id,
      item: quote.item,
      category: quote.category,
      size: quote.size,
      issue: quote.issue,
      karigarId: offer.karigar.id,
      price: offer.price,
      newPrice: quote.newPrice,
      beforePhoto: quote.photo,
      status: "waiting",
    });
  }
  const stops = new Set(jobs.map((j) => j.karigarId)).size;
  const fee = basketPickupFee(fees, stops);
  const repairCharge = round2(jobs.reduce((s, j) => s + j.price, 0));
  const donation = Math.min(5, Math.max(0, round2(input.donation ?? 0)));
  const split = computeSplit(repairCharge, fee, donation);
  const saathi = db.saathis[Math.floor(Math.random() * db.saathis.length)];
  const order: Order = {
    id: id("SD"),
    kind: "basket",
    jobs,
    familyPay: cleanFamilyPay(input.familyPay),
    createdAt: now(),
    status: "awaiting_payment",
    quoteId: jobs[0].quoteId,
    item: `Ghar Safai basket · ${jobs.length} item${jobs.length > 1 ? "s" : ""}`,
    category: jobs[0].category,
    size: "medium",
    issue: jobs.map((j) => j.item).join(", "),
    mode: "pickup",
    karigarId: jobs[0].karigarId,
    saathiId: saathi.id,
    customer: DEMO_CUSTOMER(),
    distanceKm: farthest,
    repairCharge,
    pickupFee: fee,
    donation,
    total: split.total,
    currency: "USD",
    split: { karigar: split.karigar, saathi: split.saathi, platform: split.platform, donation: split.donation },
    pickupOtp: otp(),
    deliveryOtp: otp(),
    paypal: { mode: paypalMode(), refunds: [] },
    beforePhoto: jobs[0].beforePhoto,
    payouts: [],
    complaints: [],
    events: [],
    bookedBy: input.bookedBy ?? "customer",
  };
  log(order, {
    status: "awaiting_payment",
    actor: order.bookedBy,
    message: `Ghar Safai basket booked: ${jobs.length} items with ${stops} karigar${stops > 1 ? "s" : ""}, one Saathi trip ($${fee.toFixed(2)} pickup instead of $${round2(fees.reduce((a, b) => a + b, 0)).toFixed(2)} for separate trips).`,
  });
  return finalizeNewOrder(order);
}

async function mutate(orderId: string, fn: (o: Order) => Promise<void> | void): Promise<Order> {
  return updateDB(async (db) => {
    const o = db.orders.find((x) => x.id === orderId);
    if (!o) throw new FlowError("Order not found", 404);
    await fn(o);
    return o;
  });
}

// Unpaid bookings are released after a while, like a cart that times out. Family Pay gets
// longer because a relative in another city may only open the link later in the day.
const UNPAID_TTL_MS = 2 * 60 * 60 * 1000;
const FAMILY_PAY_TTL_MS = 24 * 60 * 60 * 1000;

export async function expireUnpaidOrders(): Promise<void> {
  const cutoff = (o: Order) => Date.parse(o.createdAt) + (o.familyPay ? FAMILY_PAY_TTL_MS : UNPAID_TTL_MS);
  if (!readDB().orders.some((o) => o.status === "awaiting_payment" && cutoff(o) < Date.now())) return;
  await updateDB((db) => {
    for (const o of db.orders) {
      if (o.status !== "awaiting_payment" || cutoff(o) >= Date.now()) continue;
      log(o, { status: "cancelled", actor: "system", message: "Payment was not completed in time, so the booking was released. Nothing was charged." });
    }
  });
}

export async function approveOrder(orderId: string, paypalOrderId: string): Promise<Order> {
  return mutate(orderId, async (o) => {
    if (o.status === "cancelled") throw new FlowError("This booking has expired or was cancelled. Please book again; nothing was charged.", 409);
    if (o.status !== "awaiting_payment") return; // idempotent
    if (o.paypal.orderId !== paypalOrderId) throw new FlowError("PayPal order id does not match this booking");
    try {
      const auth = await authorizeOrder(paypalOrderId);
      o.paypal.authorizationId = auth.authorizationId;
      if (o.familyPay) {
        o.familyPay.paidBy = auth.payerEmail ?? o.familyPay.email ?? o.familyPay.name;
        o.familyPay.paidAt = now();
        log(o, { actor: "customer", message: `${o.familyPay.name} (${o.familyPay.relation}) approved the payment with PayPal from their own account.` });
      } else if (auth.payerEmail) o.customer.email = auth.payerEmail;
      log(o, {
        status: "authorized",
        actor: "system",
        kind: "paypal",
        message: `Payment of $${o.total.toFixed(2)} authorized and held by PayPal. It is captured only after the delivery OTP.`,
        ref: auth.authorizationId,
      });
      log(o, {
        actor: "system",
        message:
          o.mode === "pickup"
            ? `Repair Saathi assigned. Share pickup OTP ${o.pickupOtp} at pickup.`
            : `Karigar will visit. Share arrival OTP ${o.pickupOtp} when they arrive.`,
      });
    } catch (e) {
      const d = describePayPalError(e);
      log(o, { actor: "system", kind: "error", message: `Authorization failed: ${d.message}`, ref: d.ref });
      throw new FlowError(`PayPal authorization failed: ${d.message}`, 502);
    }
  });
}

// ---------- Job progress (OTP-gated) ----------

export type Action = "pickup" | "drop_at_karigar" | "start_repair" | "mark_repaired" | "out_for_delivery" | "deliver" | "cancel";

const NEXT: Record<Action, { from: OrderStatus[]; to: OrderStatus; actor: OrderEvent["actor"] }> = {
  pickup: { from: ["authorized"], to: "picked_up", actor: "saathi" },
  drop_at_karigar: { from: ["picked_up"], to: "at_karigar", actor: "saathi" },
  start_repair: { from: ["at_karigar", "authorized"], to: "repairing", actor: "karigar" },
  mark_repaired: { from: ["repairing"], to: "repaired", actor: "karigar" },
  out_for_delivery: { from: ["repaired"], to: "out_for_delivery", actor: "saathi" },
  deliver: { from: ["out_for_delivery", "repaired"], to: "delivered", actor: "saathi" },
  cancel: { from: ["awaiting_payment", "authorized"], to: "cancelled", actor: "customer" },
};

export async function advance(orderId: string, action: Action, opts: { otp?: string; afterPhoto?: string; jobId?: string } = {}): Promise<Order> {
  const order = await mutate(orderId, async (o) => {
    if (o.kind === "basket" && (action === "start_repair" || action === "mark_repaired")) {
      await advanceJob(o, action, opts);
      return;
    }
    const step = NEXT[action];
    if (!step) throw new FlowError("Unknown action");
    if (!step.from.includes(o.status)) throw new FlowError(`Cannot ${action.replaceAll("_", " ")} while the order is ${o.status.replaceAll("_", " ")}`);
    if (action === "start_repair" && o.status === "authorized" && o.mode === "pickup") throw new FlowError("Item has not been picked up yet");
    if (action === "deliver" && o.status === "repaired" && o.mode === "pickup") throw new FlowError("Send the item out for delivery first");
    if (action === "out_for_delivery" && o.mode !== "pickup") throw new FlowError("Home visits have no delivery leg");

    const needsPickupOtp = action === "pickup" || (action === "start_repair" && o.mode === "home-visit");
    if (needsPickupOtp && opts.otp?.trim() !== o.pickupOtp) throw new FlowError("Wrong OTP. Ask the customer for the pickup/arrival OTP shown in their app.");
    if (action === "deliver" && opts.otp?.trim() !== o.deliveryOtp) throw new FlowError("Wrong OTP. Ask the customer for the delivery OTP shown in their app.");

    const k = readDB().karigars.find((x) => x.id === o.karigarId);
    const messages: Record<Action, string> = {
      pickup: "Picked up by Repair Saathi. Pickup OTP verified and handover photo saved.",
      drop_at_karigar:
        o.kind === "basket"
          ? `Dropped ${o.jobs?.length ?? 0} items at ${[...new Set((o.jobs ?? []).map((j) => readDB().karigars.find((x) => x.id === j.karigarId)?.shop))].join(", ")}.`
          : `Handed over to ${k?.shop ?? "karigar"}.`,
      start_repair: o.mode === "home-visit" ? "Karigar arrived (OTP verified) and started the repair." : "Karigar inspected the item and started the repair.",
      mark_repaired: "Karigar marked the repair done and uploaded an after photo.",
      out_for_delivery: `Out for delivery. Share delivery OTP ${o.deliveryOtp} when the item reaches you.`,
      deliver: "Delivered. Delivery OTP verified.",
      cancel: "Booking cancelled by customer.",
    };

    if (action === "mark_repaired") {
      if (!opts.afterPhoto) throw new FlowError("Upload an after photo of the repaired item");
      o.afterPhoto = opts.afterPhoto;
      log(o, { status: "repaired", actor: "karigar", message: messages.mark_repaired });
      const check = await checkCompletion(o);
      o.completionCheck = check;
      if (!check.passed) {
        log(o, { status: "repairing", actor: "system", kind: "ai", message: `AI completion check did not pass: ${check.reasoning} Payment stays on hold${check.needsReview ? " while a Sudhaar reviewer checks the photos" : ""}.` });
      } else {
        log(o, { actor: "system", kind: "ai", message: `AI completion check passed: ${check.reasoning}` });
      }
      return;
    }

    if (action === "cancel" && o.paypal.authorizationId && o.status === "authorized") {
      try {
        await voidAuthorization(o.paypal.authorizationId);
        log(o, { actor: "system", kind: "paypal", message: "Held payment released (authorization voided). No money was taken.", ref: o.paypal.authorizationId });
      } catch (e) {
        const d = describePayPalError(e);
        throw new FlowError(`Could not void the authorization: ${d.message}`, 502);
      }
    }
    log(o, { status: step.to, actor: o.mode === "home-visit" && step.actor === "saathi" ? "karigar" : step.actor, message: messages[action] });
  });

  if (action === "deliver") return settle(orderId);
  return order;
}

/** Basket orders: each karigar starts and finishes their own items. */
async function advanceJob(o: Order, action: "start_repair" | "mark_repaired", opts: { afterPhoto?: string; jobId?: string }) {
  const job = o.jobs?.find((j) => j.id === opts.jobId);
  if (!job) throw new FlowError("Pick which item in the basket");
  if (!["at_karigar", "repairing"].includes(o.status)) throw new FlowError("The basket has not reached the karigars yet");
  if (action === "start_repair") {
    if (job.status !== "waiting") throw new FlowError("This item is already being repaired");
    job.status = "repairing";
    log(o, { status: "repairing", actor: "karigar", message: `Repair started: ${job.item}.` });
    return;
  }
  if (job.status !== "repairing") throw new FlowError("Start the repair first");
  if (!opts.afterPhoto) throw new FlowError("Upload an after photo of the repaired item");
  job.afterPhoto = opts.afterPhoto;
  const check = await checkCompletion({ ...o, item: job.item, issue: job.issue, beforePhoto: job.beforePhoto, afterPhoto: job.afterPhoto });
  job.completionCheck = check;
  if (!check.passed) {
    log(o, { actor: "system", kind: "ai", message: `AI check did not pass for ${job.item}: ${check.reasoning}${check.needsReview ? " A Sudhaar reviewer will check the photos." : ""}` });
    return;
  }
  log(o, { actor: "system", kind: "ai", message: `${job.item} repaired. AI check passed: ${check.reasoning}` });
  finishJob(o, job);
}

function finishJob(o: Order, job: Job) {
  job.status = "repaired";
  const left = (o.jobs ?? []).filter((j) => j.status !== "repaired").length;
  if (left === 0) {
    o.afterPhoto = job.afterPhoto;
    o.completionCheck = { passed: true, reasoning: "Every item in the basket passed its photo check.", source: job.completionCheck?.source ?? "simulated" };
    log(o, { status: "repaired", actor: "system", message: "All basket items repaired. The Saathi will collect everything in one trip." });
  } else {
    log(o, { actor: "system", message: `${left} item${left > 1 ? "s" : ""} still in repair.` });
  }
}

/**
 * Human review of a photo check the AI could not pass. Approving releases the item for
 * delivery (the money is still only captured after the delivery OTP); "redo" sends it back.
 */
export async function reviewCompletion(orderId: string, input: { jobId?: string; approve: boolean }): Promise<Order> {
  return mutate(orderId, (o) => {
    const job = input.jobId ? o.jobs?.find((j) => j.id === input.jobId) : undefined;
    if (input.jobId && !job) throw new FlowError("Item not found in this basket", 404);
    const target = job ?? o;
    const waiting = job ? job.status === "repairing" : o.status === "repairing";
    if (!waiting || !target.afterPhoto || !target.completionCheck?.needsReview) throw new FlowError("Nothing to review for this repair");
    const item = job?.item ?? o.item;
    if (input.approve) {
      target.completionCheck = { passed: true, reasoning: "Approved by a Sudhaar reviewer after comparing the before and after photos.", source: "admin" };
      log(o, { actor: "admin", message: `Sudhaar reviewer approved the repair photos for ${item}.` });
      if (job) finishJob(o, job);
      else log(o, { status: "repaired", actor: "admin", message: "Repair confirmed. Ready for delivery." });
    } else {
      target.completionCheck = { passed: false, reasoning: "A Sudhaar reviewer asked the karigar to finish the repair and upload a clearer after photo.", source: "admin" };
      log(o, { actor: "admin", message: `Sudhaar reviewer sent ${item} back to the karigar. Payment stays on hold.` });
    }
  });
}

// ---------- Settlement: capture -> payouts -> invoice ----------

export async function settle(orderId: string): Promise<Order> {
  return mutate(orderId, async (o) => {
    if (o.status !== "delivered" || !o.paypal.authorizationId) return;
    if (!o.paypal.captureId) {
      try {
        const cap = await captureAuthorization(o.paypal.authorizationId, o.total, o.id);
        o.paypal.captureId = cap.captureId;
        log(o, { actor: "system", kind: "paypal", message: `Captured $${o.total.toFixed(2)} from the held payment (status ${cap.status}).`, ref: cap.captureId });
      } catch (e) {
        const d = describePayPalError(e);
        log(o, { actor: "system", kind: "error", message: `Capture failed: ${d.message}`, ref: d.ref });
        return;
      }
    }
    if (!o.paypal.payoutBatchId) {
      const db = readDB();
      const k = db.karigars.find((x) => x.id === o.karigarId)!;
      const s = db.saathis.find((x) => x.id === o.saathiId)!;
      const karigarAmount = o.mode === "home-visit" ? round2(o.split.karigar + o.split.saathi) : o.split.karigar;
      type Line = { to: "karigar" | "saathi"; label: string; receiver: string; amount: number; note: string; ref: string };
      let lines: Line[];
      if (o.kind === "basket" && o.jobs) {
        // One payment in, several karigars out: each gets 90% of their own jobs.
        const byKarigar = new Map<string, number>();
        for (const j of o.jobs) byKarigar.set(j.karigarId, round2((byKarigar.get(j.karigarId) ?? 0) + j.price * 0.9));
        lines = [...byKarigar].map(([kid, amount], i) => {
          const kk = db.karigars.find((x) => x.id === kid)!;
          return { to: "karigar" as const, label: kk.shop, receiver: kk.payoutEmail, amount, note: `Sudhaar ${o.id}: Ghar Safai repairs. Thank you!`, ref: `${o.id}-K${i + 1}` };
        });
      } else {
        lines = [{ to: "karigar", label: k.shop, receiver: k.payoutEmail, amount: karigarAmount, note: `Sudhaar ${o.id}: ${o.item} repair. Thank you!`, ref: `${o.id}-K` }];
      }
      if (o.mode === "pickup") lines.push({ to: "saathi", label: s.name, receiver: s.payoutEmail, amount: o.split.saathi, note: `Sudhaar ${o.id}: pickup & delivery.`, ref: `${o.id}-S` });
      try {
        const batch = await sendPayouts(o.id, lines);
        o.paypal.payoutBatchId = batch.batchId;
        o.payouts = lines.map((l) => ({ to: l.to, label: l.label, receiver: l.receiver, amount: l.amount, status: batch.status }));
        log(o, {
          status: "paid_out",
          actor: "system",
          kind: "paypal",
          message: `Instant payouts sent: ${lines.map((l) => `${l.label} $${l.amount.toFixed(2)}`).join(", ")}. Sudhaar keeps $${o.split.platform.toFixed(2)}${o.donation ? `, $${o.donation.toFixed(2)} to the karigar tool fund` : ""}.`,
          ref: batch.batchId,
        });
      } catch (e) {
        const d = describePayPalError(e);
        log(o, { actor: "system", kind: "error", message: `Payout failed: ${d.message}`, ref: d.ref });
      }
    }
    if (!o.paypal.invoiceId) {
      try {
        const inv = await createPaidInvoice(o, o.customer.email);
        o.paypal.invoiceId = inv.invoiceId;
        o.paypal.invoiceUrl = inv.url;
        log(o, { actor: "system", kind: "paypal", message: "Digital bill issued as a PayPal invoice and marked paid.", ref: inv.invoiceId });
      } catch (e) {
        const d = describePayPalError(e);
        log(o, { actor: "system", kind: "error", message: `Invoice could not be created: ${d.message}`, ref: d.ref });
      }
    }
  });
}

// ---------- Resolve Hub ----------

export async function raiseComplaint(orderId: string, input: { issue: Complaint["issue"]; details: string; photo?: string }): Promise<Order> {
  const current = readDB().orders.find((o) => o.id === orderId);
  if (!current) throw new FlowError("Order not found", 404);
  if (!current.paypal.captureId) throw new FlowError("Complaints open after the item is delivered and paid.");
  const ai = await reviewComplaint(current, input);
  return mutate(orderId, (o) => {
    const c: Complaint = { id: id("C"), createdAt: now(), issue: input.issue, details: input.details, photo: input.photo, ai };
    o.complaints.unshift(c);
    log(o, { actor: "customer", message: `Complaint raised in Resolve Hub: ${input.issue.replaceAll("_", " ")}.` });
    log(o, {
      actor: "system",
      kind: "ai",
      message: `AI review recommends ${ai.recommendation.replaceAll("_", " ")}${ai.refundAmount ? ` ($${ai.refundAmount.toFixed(2)})` : ""}: ${ai.reasoning}`,
    });
  });
}

export async function resolveComplaint(orderId: string, complaintId: string, decision: { action: "refund" | "re_repair" | "rejected"; amount?: number }): Promise<Order> {
  return mutate(orderId, async (o) => {
    const c = o.complaints.find((x) => x.id === complaintId);
    if (!c) throw new FlowError("Complaint not found", 404);
    if (c.resolution) return;
    if (decision.action === "refund") {
      const refunded = o.paypal.refunds.reduce((s, r) => s + r.amount, 0);
      const amount = round2(Math.min(decision.amount ?? 0, o.total - refunded));
      if (amount <= 0) throw new FlowError("Nothing left to refund");
      try {
        const r = await refundCapture(o.paypal.captureId!, amount, `Sudhaar Resolve Hub: ${c.issue.replaceAll("_", " ")} on ${o.item}`, c.id);
        o.paypal.refunds.push({ id: r.refundId, amount, status: r.status });
        c.resolution = { action: "refund", amount, refundId: r.refundId, at: now() };
        log(o, { actor: "admin", kind: "paypal", message: `Refunded $${amount.toFixed(2)} to the customer via PayPal (status ${r.status}).`, ref: r.refundId });
      } catch (e) {
        const d = describePayPalError(e);
        throw new FlowError(`Refund failed: ${d.message}`, 502);
      }
    } else if (decision.action === "re_repair") {
      c.resolution = { action: "re_repair", at: now() };
      log(o, { actor: "admin", message: "Free warranty re-repair approved. A Repair Saathi will collect the item again at no cost." });
    } else {
      c.resolution = { action: "rejected", at: now() };
      log(o, { actor: "admin", message: "Complaint reviewed and closed without refund." });
    }
  });
}

// ---------- Impact + admin ----------

export function impactStats() {
  const db = readDB();
  const done = db.orders.filter((o) => o.paypal.captureId);
  const quotes = new Map(db.quotes.map((q) => [q.id, q]));
  const items = done.flatMap((o) => (o.jobs?.length ? o.jobs.map((j) => ({ category: j.category, price: j.price, newPrice: j.newPrice })) : [{ category: o.category, price: o.repairCharge, newPrice: quotes.get(o.quoteId)?.newPrice ?? 0 }]));
  const saved = items.reduce((s, i) => s + Math.max(0, i.newPrice - i.price), 0);
  const kg = items.reduce((s, i) => s + AVG_ITEM_KG[i.category], 0);
  const karigarEarnings = done.reduce((s, o) => s + o.payouts.filter((p) => p.to === "karigar").reduce((a, p) => a + p.amount, 0), 0);
  const saathiEarnings = done.reduce((s, o) => s + o.payouts.filter((p) => p.to === "saathi").reduce((a, p) => a + p.amount, 0), 0);
  const refunds = db.orders.reduce((s, o) => s + o.paypal.refunds.reduce((a, r) => a + r.amount, 0), 0);
  const fund = done.reduce((s, o) => s + o.donation, 0);
  return {
    itemsRepaired: items.length,
    kgSaved: round2(kg),
    moneySaved: round2(saved),
    karigarEarnings: round2(karigarEarnings),
    saathiEarnings: round2(saathiEarnings),
    refunds: round2(refunds),
    toolFund: round2(fund),
    activeOrders: db.orders.filter((o) => !["paid_out", "cancelled", "awaiting_payment"].includes(o.status)).length,
  };
}

export function getOrder(orderId: string) {
  return readDB().orders.find((o) => o.id === orderId);
}
