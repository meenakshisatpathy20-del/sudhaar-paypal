import crypto from "node:crypto";
import { checkCompletion, quoteItem, reviewComplaint } from "./ai";
import { config, serviceProblems } from "./config";
import { placeNear } from "./geo";
import { readDB, updateDB } from "./db";
import {
  authorizeOrder,
  captureAuthorization,
  captureOrder,
  createAuthorizeOrder,
  createPaidInvoice,
  createTipOrder,
  createTopUpOrder,
  describePayPalError,
  paypalMode,
  refundCapture,
  sendPayouts,
  voidAuthorization,
} from "./paypal";
import { AVG_ITEM_KG, basketPickupFee, computeSplit, haversineKm, INR_PER_USD, karigarPrice, pickupFee, round2, serviceModeFor } from "./pricing";
import { canRate, liveStats, orderKarigars } from "./reviews";
import { acceptSlot, pickupSlots } from "./slots";
import type { Account, Category, Complaint, FamilyPay, Job, Karigar, Order, OrderEvent, OrderStatus, PickupSlot, Quote, Saathi } from "./types";

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
export function offersFor(quote: Quote, at: { lat: number; lng: number } = DEMO_CUSTOMER()): KarigarOffer[] {
  const db = readDB();
  const mode = serviceModeFor(quote.category);
  const offers = db.karigars
    .filter((k) => k.verified && k.skills.includes(quote.category) && !(db.offline ?? []).includes(k.id))
    .map(liveStats)
    .map((k) => {
      const distanceKm = haversineKm(at, placeNear(k, at));
      const fee = pickupFee(distanceKm, quote.size, mode);
      if (fee === null) return null;
      const price = karigarPrice(quote.repairLow, quote.repairHigh, k);
      const readyInDays = Math.max(quote.repairDays, k.turnaroundDays);
      // Lower is better: cost, then distance and days, rewarded by rating.
      // Karigars nobody has rated yet count as average (4.0) so they still get work.
      const rating = k.ratingCount ? k.rating : 4;
      const score = round2(price + fee + distanceKm * 0.15 + readyInDays * 0.5 - (rating - 4) * 2);
      return { karigar: k, distanceKm, price, pickupFee: fee, total: round2(price + fee), readyInDays, score };
    })
    .filter((o): o is KarigarOffer => o !== null)
    .sort((a, b) => a.score - b.score);
  if (offers[0]) offers[0].best = true;
  return offers;
}

/** A random Saathi among those who are online (any Saathi if everyone is offline). */
function pickSaathi(saathis: Saathi[], offline: string[] = []) {
  const online = saathis.filter((x) => !offline.includes(x.id));
  const pool = online.length ? online : saathis;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Booking + PayPal authorize ----------

/** What an order remembers about the customer (the PayPal email is filled in when they pay). */
function customerSnapshot(a: Account): Order["customer"] {
  return { name: a.name, email: config.paypal.customerEmail, address: a.address ?? "", lat: a.lat ?? config.demoCenter.lat, lng: a.lng ?? config.demoCenter.lng };
}

export async function createOrder(input: {
  customer: Account;
  quoteId: string;
  karigarId: string;
  donation?: number;
  bookedBy?: "customer" | "agent";
  familyPay?: { name: string; relation: string; email?: string };
  pickupSlot?: PickupSlot;
}): Promise<Order> {
  const db = readDB();
  const quote = db.quotes.find((q) => q.id === input.quoteId);
  if (!quote) throw new FlowError("Quote not found", 404);
  const customer = customerSnapshot(input.customer);
  const offer = offersFor(quote, customer).find((o) => o.karigar.id === input.karigarId);
  if (!offer) throw new FlowError("That karigar cannot take this job", 404);
  const donation = Math.min(5, Math.max(0, round2(input.donation ?? 0)));
  const split = computeSplit(offer.price, offer.pickupFee, donation);
  const mode = serviceModeFor(quote.category);
  const saathi = pickSaathi(db.saathis, db.offline);
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
    customerId: input.customer.id,
    customer,
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
    pickupSlot: chooseSlot(input.pickupSlot),
  };
  log(order, {
    status: "awaiting_payment",
    actor: order.bookedBy,
    message: `Booked ${offer.karigar.shop} for "${quote.item}" at $${offer.price.toFixed(2)} + $${offer.pickupFee.toFixed(2)} ${mode === "pickup" ? "pickup" : "visit"} fee.`,
  });
  return finalizeNewOrder(order);
}

/** The customer's chosen pickup window, or the earliest one when none was given (e.g. the agent). */
function chooseSlot(slot?: PickupSlot): PickupSlot {
  if (slot === undefined) return pickupSlots()[0];
  const ok = acceptSlot(slot);
  if (!ok) throw new FlowError("That pickup time is no longer available. Please choose another.");
  return ok;
}

function cleanFamilyPay(fp?: { name: string; relation: string; email?: string }): FamilyPay | undefined {
  if (!fp?.name?.trim()) return undefined;
  return {
    token: crypto.randomBytes(16).toString("hex"),
    name: fp.name.trim().slice(0, 60),
    relation: (fp.relation || "family").trim().slice(0, 30),
    email: fp.email?.trim().slice(0, 120) || undefined,
  };
}

/** The link a family member opens to pay. The token keeps other people's orders unguessable. */
export const familyPayPath = (o: Order) => (o.familyPay?.token ? `/pay/${o.id}?t=${o.familyPay.token}` : `/pay/${o.id}`);

async function finalizeNewOrder(order: Order): Promise<Order> {
  if (order.familyPay) {
    log(order, { actor: "customer", message: `Family Pay: payment request sent to ${order.familyPay.name} (${order.familyPay.relation}). They can pay with PayPal from anywhere.` });
  }
  try {
    const pp = await createAuthorizeOrder(order);
    order.paypal.orderId = pp.id;
  } catch (e) {
    // PayPal rejected our keys: switch to labelled simulation (admin System check explains) rather than
    // failing every booking. Any other PayPal error is shown to the customer as before.
    if ((e as { status?: number }).status !== 401 || serviceProblems.paypal) {
      const d = describePayPalError(e);
      throw new FlowError(`Could not create the PayPal order: ${d.message}`, 502);
    }
    serviceProblems.paypal = "PayPal rejected the Client ID / Secret";
    console.warn("[health] PayPal rejected the Client ID / Secret; payments are simulated until the keys are fixed.");
    order.paypal.mode = paypalMode();
    order.paypal.orderId = (await createAuthorizeOrder(order)).id;
  }
  log(order, { actor: "system", kind: "paypal", message: "PayPal order created with intent AUTHORIZE (money will be held, not taken).", ref: order.paypal.orderId });
  await updateDB((db) => {
    db.orders.unshift(order);
  });
  return order;
}

// ---------- Ghar Safai Mode: many items, one pickup, one PayPal payment ----------

export async function createBasketOrder(input: {
  customer: Account;
  items: { quoteId: string; karigarId: string }[];
  donation?: number;
  bookedBy?: "customer" | "agent";
  familyPay?: { name: string; relation: string; email?: string };
  pickupSlot?: PickupSlot;
}): Promise<Order> {
  if (!input.items?.length) throw new FlowError("Add at least one item to the basket");
  if (input.items.length > 12) throw new FlowError("A basket can hold up to 12 items");
  const db = readDB();
  const customer = customerSnapshot(input.customer);
  const jobs: Job[] = [];
  const fees: number[] = [];
  let farthest = 0;
  for (const it of input.items) {
    const quote = db.quotes.find((q) => q.id === it.quoteId);
    if (!quote) throw new FlowError("Quote not found", 404);
    if (serviceModeFor(quote.category) !== "pickup") throw new FlowError(`"${quote.item}" needs a home visit, so book it separately`);
    const offer = offersFor(quote, customer).find((o) => o.karigar.id === it.karigarId);
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
  const saathi = pickSaathi(db.saathis, db.offline);
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
    customerId: input.customer.id,
    customer,
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
    pickupSlot: chooseSlot(input.pickupSlot),
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
      o.paypal.heldAmount = o.total;
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
      if (o.priceChange && ["pending", "awaiting_payment"].includes(o.priceChange.status)) throw new FlowError("Waiting for the customer to answer the price change");
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
  if (action === "mark_repaired" && o.priceChange?.jobId === job.id && ["pending", "awaiting_payment"].includes(o.priceChange.status)) throw new FlowError("Waiting for the customer to answer the price change");
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
    // The main hold covers the original price; an approved increase sits in a second (top-up) hold.
    // A lower final price simply captures less than was held.
    const held = o.paypal.heldAmount ?? o.total;
    const mainAmount = round2(Math.min(o.total, held));
    if (!o.paypal.captureId) {
      try {
        const cap = await captureAuthorization(o.paypal.authorizationId, mainAmount, o.id);
        o.paypal.captureId = cap.captureId;
        o.paypal.capturedAmount = mainAmount;
        log(o, { actor: "system", kind: "paypal", message: `Captured $${mainAmount.toFixed(2)} from the held payment (status ${cap.status}).`, ref: cap.captureId });
      } catch (e) {
        const d = describePayPalError(e);
        log(o, { actor: "system", kind: "error", message: `Capture failed: ${d.message}`, ref: d.ref });
        return;
      }
    }
    const topUp = o.priceChange?.status === "approved" ? o.priceChange.topUp : undefined;
    if (topUp?.authorizationId && !topUp.captureId) {
      try {
        const cap = await captureAuthorization(topUp.authorizationId, topUp.amount, `${o.id}-extra`);
        topUp.captureId = cap.captureId;
        log(o, { actor: "system", kind: "paypal", message: `Captured the approved extra $${topUp.amount.toFixed(2)} (status ${cap.status}).`, ref: cap.captureId });
      } catch (e) {
        const d = describePayPalError(e);
        log(o, { actor: "system", kind: "error", message: `Extra capture failed: ${d.message}`, ref: d.ref });
        return;
      }
    }
    if (!o.paypal.payoutBatchId) {
      const db = readDB();
      const k = db.karigars.find((x) => x.id === o.karigarId)!;
      const s = db.saathis.find((x) => x.id === o.saathiId)!;
      const karigarAmount = o.mode === "home-visit" ? round2(o.split.karigar + o.split.saathi) : o.split.karigar;
      type Line = { to: "karigar" | "saathi"; partnerId: string; label: string; receiver: string; amount: number; note: string; ref: string };
      let lines: Line[];
      if (o.kind === "basket" && o.jobs) {
        // One payment in, several karigars out: each gets 90% of their own jobs.
        const byKarigar = new Map<string, number>();
        for (const j of o.jobs) byKarigar.set(j.karigarId, round2((byKarigar.get(j.karigarId) ?? 0) + j.price * 0.9));
        lines = [...byKarigar].map(([kid, amount], i) => {
          const kk = db.karigars.find((x) => x.id === kid)!;
          return { to: "karigar" as const, partnerId: kid, label: kk.shop, receiver: kk.payoutEmail, amount, note: `Sudhaar ${o.id}: Ghar Safai repairs. Thank you!`, ref: `${o.id}-K${i + 1}` };
        });
      } else {
        lines = [{ to: "karigar", partnerId: k.id, label: k.shop, receiver: k.payoutEmail, amount: karigarAmount, note: `Sudhaar ${o.id}: ${o.item} repair. Thank you!`, ref: `${o.id}-K` }];
      }
      if (o.mode === "pickup") lines.push({ to: "saathi", partnerId: s.id, label: s.name, receiver: s.payoutEmail, amount: o.split.saathi, note: `Sudhaar ${o.id}: pickup & delivery.`, ref: `${o.id}-S` });
      try {
        const batch = await sendPayouts(o.id, lines);
        o.paypal.payoutBatchId = batch.batchId;
        // Keep any tip already paid out; this batch is the repair and pickup money.
        o.payouts = [...o.payouts.filter((p) => p.kind === "tip"), ...lines.map((l) => ({ to: l.to, partnerId: l.partnerId, label: l.label, receiver: l.receiver, amount: l.amount, status: batch.status }))];
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
      // Refund from the main capture first; anything beyond it comes from the extra-work capture.
      const mainLeft = round2((o.paypal.capturedAmount ?? o.total) - refunded);
      const extraCapture = o.priceChange?.topUp?.captureId;
      const fromMain = extraCapture ? round2(Math.min(amount, Math.max(0, mainLeft))) : amount;
      try {
        if (extraCapture && amount > fromMain) {
          const extra = await refundCapture(extraCapture, round2(amount - fromMain), `Sudhaar Resolve Hub: ${o.item} (extra work)`, `${c.id}-x`);
          o.paypal.refunds.push({ id: extra.refundId, amount: round2(amount - fromMain), status: extra.status });
          if (fromMain <= 0) {
            c.resolution = { action: "refund", amount, refundId: extra.refundId, at: now() };
            log(o, { actor: "admin", kind: "paypal", message: `Refunded $${amount.toFixed(2)} to the customer via PayPal (status ${extra.status}).`, ref: extra.refundId });
            return;
          }
        }
        const r = await refundCapture(o.paypal.captureId!, fromMain, `Sudhaar Resolve Hub: ${c.issue.replaceAll("_", " ")} on ${o.item}`, c.id);
        o.paypal.refunds.push({ id: r.refundId, amount: fromMain, status: r.status });
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

// ---------- Price change after inspection (karigar asks, customer decides) ----------

/** Re-price the order after a karigar's price change: pickup fee and tool fund stay the same. */
function reprice(o: Order) {
  o.repairCharge = o.jobs?.length ? round2(o.jobs.reduce((sum, j) => sum + j.price, 0)) : o.repairCharge;
  const split = computeSplit(o.repairCharge, o.pickupFee, o.donation);
  o.total = split.total;
  o.split = { karigar: split.karigar, saathi: split.saathi, platform: split.platform, donation: split.donation };
}

export async function requestPriceChange(karigarId: string, orderId: string, input: { jobId?: string; newPrice: number; reason: string }): Promise<Order> {
  return mutate(orderId, (o) => {
    if (o.priceChange && ["pending", "awaiting_payment"].includes(o.priceChange.status)) throw new FlowError("There is already a price change waiting for the customer");
    const job = input.jobId ? o.jobs?.find((j) => j.id === input.jobId) : undefined;
    if (input.jobId && (!job || job.karigarId !== karigarId)) throw new FlowError("Item not found", 404);
    if (!job && o.karigarId !== karigarId) throw new FlowError("Order not found", 404);
    const inspecting = job ? ["waiting", "repairing"].includes(job.status) && ["at_karigar", "repairing"].includes(o.status) : ["at_karigar", "repairing"].includes(o.status) || (o.mode === "home-visit" && o.status === "authorized");
    if (!inspecting) throw new FlowError("Prices can only change after inspection and before the repair is done");
    const from = job ? job.price : o.repairCharge;
    const to = round2(Number(input.newPrice));
    const reason = String(input.reason ?? "").trim().slice(0, 200);
    if (!(to >= 0.5) || to > from * 3 || to > 100) throw new FlowError("Please enter a sensible new price");
    if (to === from) throw new FlowError("That is the same price");
    if (!reason) throw new FlowError("Tell the customer why the price changed");
    o.priceChange = { jobId: job?.id, item: job?.item ?? o.item, from, to, reason, status: "pending", requestedAt: now() };
    log(o, { actor: "karigar", message: `After inspection, the karigar asked to change the price of ${o.priceChange.item} from $${from.toFixed(2)} to $${to.toFixed(2)}: "${reason}". Waiting for the customer.` });
  });
}

export async function decidePriceChange(orderId: string, approve: boolean): Promise<Order> {
  return mutate(orderId, async (o) => {
    const pc = o.priceChange;
    if (!pc || pc.status !== "pending") throw new FlowError("No price change is waiting for you");
    pc.decidedAt = now();
    if (!approve) {
      pc.status = "declined";
      log(o, { actor: "customer", message: `Customer kept the original price of $${pc.from.toFixed(2)} for ${pc.item}.` });
      return;
    }
    if (pc.to < pc.from) {
      applyPrice(o, pc);
      log(o, { actor: "customer", message: `Customer approved the lower price of $${pc.to.toFixed(2)}. PayPal will capture less than it holds.` });
      return;
    }
    // A higher price needs a second hold for the difference, approved in PayPal like the first.
    const extra = round2(pc.to - pc.from);
    try {
      const pp = await createTopUpOrder(o, extra, pc.reason);
      pc.topUp = { amount: extra, paypalOrderId: pp.id };
      pc.status = "awaiting_payment";
      log(o, { actor: "customer", kind: "paypal", message: `Customer approved the new price. A PayPal hold for the extra $${extra.toFixed(2)} is ready for them to approve.`, ref: pp.id });
    } catch (e) {
      const d = describePayPalError(e);
      throw new FlowError(`Could not create the PayPal order for the extra amount: ${d.message}`, 502);
    }
  });
}

/** The customer approved the extra-amount PayPal order: hold it, then apply the new price. */
export async function approveTopUp(orderId: string, paypalOrderId: string): Promise<Order> {
  return mutate(orderId, async (o) => {
    const pc = o.priceChange;
    if (!pc || pc.status !== "awaiting_payment" || !pc.topUp) throw new FlowError("No extra payment is waiting");
    if (pc.topUp.paypalOrderId !== paypalOrderId) throw new FlowError("PayPal order id does not match");
    try {
      const auth = await authorizeOrder(paypalOrderId);
      pc.topUp.authorizationId = auth.authorizationId;
      applyPrice(o, pc);
      log(o, { actor: "customer", kind: "paypal", message: `Extra $${pc.topUp.amount.toFixed(2)} held by PayPal. New repair price: $${pc.to.toFixed(2)}.`, ref: auth.authorizationId });
    } catch (e) {
      const d = describePayPalError(e);
      throw new FlowError(`PayPal authorization failed: ${d.message}`, 502);
    }
  });
}

function applyPrice(o: Order, pc: NonNullable<Order["priceChange"]>) {
  pc.status = "approved";
  const job = pc.jobId ? o.jobs?.find((j) => j.id === pc.jobId) : undefined;
  if (job) job.price = pc.to;
  else o.repairCharge = pc.to;
  reprice(o);
}

// ---------- After delivery: rating and thank-you tip ----------

/** The customer rates a karigar who worked on their delivered order (once per karigar). */
export async function rateKarigar(orderId: string, input: { karigarId: string; stars: number; text?: string }): Promise<Order> {
  return mutate(orderId, (o) => {
    if (!canRate(o)) throw new FlowError("You can rate the karigar once the item is delivered");
    if (!orderKarigars(o).includes(input.karigarId)) throw new FlowError("That karigar didn't work on this order");
    if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw new FlowError("Choose 1 to 5 stars");
    o.ratings ??= [];
    if (o.ratings.some((r) => r.karigarId === input.karigarId)) throw new FlowError("You've already rated this karigar for this order");
    const text = (input.text ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300);
    o.ratings.push({ karigarId: input.karigarId, stars: input.stars, text, at: now() });
    log(o, { actor: "customer", message: `Rated ${readDB().karigars.find((k) => k.id === input.karigarId)?.shop ?? "the karigar"} ${input.stars}★${text ? ` and left a review` : ""}.` });
  });
}

/** Tip amounts on offer, in rupees. Fixed choices keep it simple and stop odd amounts. */
export const TIP_CHOICES_INR = [20, 50, 100];

/** Starts a thank-you tip: creates a pay-now PayPal order the customer approves in the popup. */
export async function startTip(orderId: string, input: { karigarId: string; inr: number }): Promise<Order> {
  return mutate(orderId, async (o) => {
    if (!canRate(o)) throw new FlowError("You can tip once the item is delivered");
    if (!orderKarigars(o).includes(input.karigarId)) throw new FlowError("That karigar didn't work on this order");
    if (!TIP_CHOICES_INR.includes(input.inr)) throw new FlowError("Choose one of the tip amounts");
    o.tips ??= [];
    if (o.tips.some((t) => t.karigarId === input.karigarId && t.status === "paid")) throw new FlowError("You've already tipped this karigar for this order. Thank you!");
    // Changing the amount replaces a tip that wasn't paid yet.
    o.tips = o.tips.filter((t) => !(t.karigarId === input.karigarId && t.status === "awaiting_payment"));
    const k = readDB().karigars.find((x) => x.id === input.karigarId)!;
    const amount = round2(input.inr / INR_PER_USD);
    const tipId = id("TIP");
    try {
      const pp = await createTipOrder(o, tipId, k.shop, amount);
      o.tips.push({ id: tipId, karigarId: k.id, amount, status: "awaiting_payment", paypalOrderId: pp.id, createdAt: now() });
    } catch (e) {
      const d = describePayPalError(e);
      throw new FlowError(`PayPal could not start the tip: ${d.message}`, 502);
    }
  });
}

/** The customer approved the tip in PayPal: capture it now and pay all of it to the karigar. */
export async function approveTip(orderId: string, tipId: string, paypalOrderId: string): Promise<Order> {
  return mutate(orderId, async (o) => {
    const tip = o.tips?.find((t) => t.id === tipId);
    if (!tip || tip.status !== "awaiting_payment") throw new FlowError("No tip is waiting for payment");
    if (tip.paypalOrderId !== paypalOrderId) throw new FlowError("PayPal order id does not match");
    const k = readDB().karigars.find((x) => x.id === tip.karigarId)!;
    try {
      const cap = await captureOrder(paypalOrderId);
      tip.captureId = cap.captureId;
      tip.status = "paid";
      tip.paidAt = now();
      log(o, { actor: "customer", kind: "paypal", message: `Thank-you tip of $${tip.amount.toFixed(2)} for ${k.shop} paid with PayPal (status ${cap.status}).`, ref: cap.captureId });
    } catch (e) {
      const d = describePayPalError(e);
      throw new FlowError(`PayPal could not take the tip: ${d.message}`, 502);
    }
    // Sudhaar keeps nothing from a tip.
    try {
      const batch = await sendPayouts(o.id, [{ receiver: k.payoutEmail, amount: tip.amount, note: `A thank-you tip from your Sudhaar customer (${o.id}).`, ref: `${o.id}-${tip.id}` }], `${o.id}-${tip.id}`);
      tip.payoutBatchId = batch.batchId;
      o.payouts.push({ to: "karigar", kind: "tip", partnerId: k.id, label: k.shop, receiver: k.payoutEmail, amount: tip.amount, status: batch.status });
      log(o, { actor: "system", kind: "paypal", message: `Tip paid out in full to ${k.shop}: $${tip.amount.toFixed(2)}.`, ref: batch.batchId });
    } catch (e) {
      const d = describePayPalError(e);
      log(o, { actor: "system", kind: "error", message: `Tip payout failed, the support team will retry: ${d.message}`, ref: d.ref });
    }
  });
}

// ---------- Partner availability ----------

export async function setOnline(partnerId: string, online: boolean) {
  return updateDB((db) => {
    const offline = new Set(db.offline ?? []);
    if (online) offline.delete(partnerId);
    else offline.add(partnerId);
    db.offline = [...offline];
    return online;
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
