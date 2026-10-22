import crypto from "node:crypto";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/openai";
import { aiEnabled, config, paypalEnabled, serviceProblems } from "./config";
import { readDB } from "./db";
import { generate, geminiSchema, isOverloaded, isRateLimit, isTimeout } from "./llm";
import { slotLabel } from "./slots";
import { INR_PER_USD } from "./pricing";
import { advance, createBasketOrder, createOrder, createQuote, familyPayPath, FlowError, offersFor, raiseComplaint, resolveComplaint } from "./orders";
import { type Lang, langMeta } from "./i18n";
import type { Account, Complaint, Order } from "./types";

// Sudhaar Repair Agent: a Gemini function-calling loop that acts for the customer.
// It quotes, picks the best karigar against the customer's budget/deadline, books the job and
// creates the PayPal order (intent AUTHORIZE), tracks it, files warranty claims and issues small
// refunds within a hard-coded policy limit. Read-only PayPal lookups (orders, invoices, refunds,
// transactions) go through the PayPal Agent Toolkit. The customer approves every payment in the
// PayPal popup, so the agent can never spend money on its own.

export const AUTO_REFUND_LIMIT = 5; // USD. Larger refunds go to the human support desk.

type Card =
  | { type: "quote"; quoteId: string; item: string; repairLow: number; repairHigh: number; newPrice: number; source: string }
  | { type: "booking"; orderId: string; paypalOrderId?: string; total: number; karigar: string; status: string; familyPayer?: string }
  | { type: "refund"; orderId: string; amount: number; refundId?: string };

interface Session {
  /** The conversation as Gemini sees it (model turns kept whole, including thought signatures). */
  messages: Content[];
  photo?: string;
  updatedAt: number;
  /** A conversation belongs to one customer account and can only touch their orders. */
  accountId: string;
}

const sessions = new Map<string, Session>();

let toolkit: PayPalAgentToolkit | null = null;
function paypalToolkit() {
  if (!paypalEnabled()) return null;
  toolkit ??= new PayPalAgentToolkit({
    clientId: config.paypal.clientId,
    clientSecret: config.paypal.clientSecret,
    configuration: {
      actions: {
        orders: { get: true },
        invoices: { get: true, list: true },
        payments: { getRefunds: true },
        transactions: { list: true },
        disputes: { list: true },
      },
      context: { sandbox: true },
    },
  });
  return toolkit;
}

const SYSTEM = `You are the Sudhaar Repair Agent. Sudhaar is a doorstep repair service: verified local karigars (cobblers, tailors, appliance, furniture and electronics repairers, plumbers, electricians) fix household items, a Repair Saathi does pickup and delivery, and payment runs through PayPal (sandbox, USD).

You act on the customer's behalf, not just advise:
1. Understand what is broken. If the customer attached a photo, call get_repair_quote with use_photo=true.
2. Choose the karigar yourself. Respect the customer's budget and deadline; otherwise pick the "best value" offer. Explain the choice in one line (price, distance, rating, ready time).
3. If the customer asked you to get it fixed (or gave a budget/deadline), call book_repair right away. Otherwise propose the best option and ask "Shall I book it?".
4. book_repair creates a PayPal order with intent AUTHORIZE. The customer must tap the PayPal button shown under your message to approve; the money is only held and is captured after the delivery OTP. Never claim the payment is done until get_order_status says it is authorized.
4a. Bookings get the earliest pickup window (shown as pickup_window, Indian time). Tell the customer when the Saathi will come.
4b. Ghar Safai Mode: if the customer has several things to fix (e.g. Diwali cleaning), quote each item, then book them together with book_ghar_safai_basket: one Saathi trip and one PayPal payment split across the karigars.
4c. Family Pay: if the customer wants a family member to pay (e.g. "ask my son to pay"), pass family_payer_name and family_payer_relation. The family member gets a link and approves with their own PayPal.
5. For problems after delivery, use raise_warranty_claim. If the AI review recommends a refund of at most $${AUTO_REFUND_LIMIT}, you may call issue_refund. Larger refunds go to the support desk.
6. Use the PayPal lookup tools (get_order, get_invoice, list_invoices, get_refund, list_transactions) when the customer asks about bills, payments or refunds.

Keep replies short and friendly (2-5 sentences), because they are often read aloud by voice. Write plain text only: no Markdown, no ** bold, no bullet symbols or headings. Use plain language and follow the language note on each message. Never invent order ids, prices or PayPal ids: only use what tools return.
Money: tools work in USD because PayPal sandbox settles in USD. Speak to the customer in rupees, converting at ₹${INR_PER_USD} per $1 and rounding to the nearest rupee (e.g. "₹338, which PayPal charges as $3.98" for a total). If the customer gives a budget in rupees, convert it to USD before comparing offers.`;

const CUSTOM_TOOLS: FunctionDeclaration[] = [
  {
    name: "get_repair_quote",
    description: "Estimate the repair (AI vision on the attached photo and/or the description) and list nearby verified karigars with price, pickup fee, distance and ready time, sorted by best value.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "What is broken, in the customer's words" },
        use_photo: { type: "boolean", description: "true if the customer attached a photo in this chat" },
      },
      required: ["description", "use_photo"],
      additionalProperties: false,
    },
  },
  {
    name: "book_repair",
    description: "Book the chosen karigar for a quote and create the PayPal order (intent AUTHORIZE). The customer then approves the payment in PayPal.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        quote_id: { type: "string" },
        karigar_id: { type: "string" },
        add_tool_fund_donation: { type: "boolean", description: `Add $1 (about ₹${INR_PER_USD}) to the karigar tool fund. Only true if the customer agreed.` },
        family_payer_name: { type: "string", description: "Family Pay: name of the family member who should pay (e.g. 'Rahul'). Empty string if the customer pays." },
        family_payer_relation: { type: "string", description: "Family Pay: relation to the customer, e.g. 'son', 'daughter'. Empty string if not used." },
      },
      required: ["quote_id", "karigar_id", "add_tool_fund_donation", "family_payer_name", "family_payer_relation"],
      additionalProperties: false,
    },
  },
  {
    name: "book_ghar_safai_basket",
    description: "Ghar Safai Mode: book several quoted items together with one Saathi pickup and ONE PayPal payment that is split to each karigar. Use when the customer has more than one item to fix.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "object", properties: { quote_id: { type: "string" }, karigar_id: { type: "string" } }, required: ["quote_id", "karigar_id"], additionalProperties: false },
        },
        family_payer_name: { type: "string", description: "Family Pay payer name, or empty string" },
        family_payer_relation: { type: "string", description: "Family Pay relation, or empty string" },
      },
      required: ["items", "family_payer_name", "family_payer_relation"],
      additionalProperties: false,
    },
  },
  {
    name: "get_order_status",
    description: "Get the live status, timeline and PayPal ids (authorization, capture, payout, invoice, refunds) of a Sudhaar order.",
    parametersJsonSchema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"], additionalProperties: false },
  },
  {
    name: "cancel_booking",
    description: "Cancel a booking before pickup. Voids the PayPal authorization so no money is taken.",
    parametersJsonSchema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"], additionalProperties: false },
  },
  {
    name: "raise_warranty_claim",
    description: "File a Resolve Hub complaint for a delivered order. The PayPal invoice is attached automatically and an AI reviewer recommends re-repair or a refund.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        issue: { type: "string", enum: ["repair_failed", "damaged", "overcharged", "delayed", "missing"] },
        details: { type: "string" },
      },
      required: ["order_id", "issue", "details"],
      additionalProperties: false,
    },
  },
  {
    name: "issue_refund",
    description: `Issue a PayPal refund for an open complaint whose AI review recommended a refund. Only works up to $${AUTO_REFUND_LIMIT}; larger amounts are escalated.`,
    parametersJsonSchema: {
      type: "object",
      properties: { order_id: { type: "string" }, complaint_id: { type: "string" } },
      required: ["order_id", "complaint_id"],
      additionalProperties: false,
    },
  },
];

function summariseOrder(o: Order) {
  return {
    order_id: o.id,
    status: o.status,
    item: o.item,
    total: o.total,
    mode: o.mode,
    paypal: o.paypal,
    payouts: o.payouts,
    complaints: o.complaints.map((c) => ({ id: c.id, issue: c.issue, ai: c.ai, resolution: c.resolution })),
    recent_events: o.events.slice(-6).map((e) => `${e.at} ${e.message}`),
    customer_otps: { pickup: o.pickupOtp, delivery: o.deliveryOtp },
  };
}

async function runCustomTool(name: string, input: Record<string, unknown>, session: Session, cards: Card[], customer: Account): Promise<unknown> {
  // Order tools only ever see this customer's own orders.
  const ownOrder = (id: unknown) => {
    const o = readDB().orders.find((x) => x.id === id && x.customerId === customer.id);
    if (!o) throw new FlowError("Order not found for this customer");
    return o;
  };
  switch (name) {
    case "get_repair_quote": {
      const quote = await createQuote({ description: String(input.description ?? ""), photo: input.use_photo ? session.photo : undefined });
      cards.push({ type: "quote", quoteId: quote.id, item: quote.item, repairLow: quote.repairLow, repairHigh: quote.repairHigh, newPrice: quote.newPrice, source: quote.source });
      return {
        quote_id: quote.id,
        item: quote.item,
        issue: quote.issue,
        repairable: quote.repairable,
        repair_range_usd: [quote.repairLow, quote.repairHigh],
        new_price_usd: quote.newPrice,
        confidence: quote.confidence,
        estimator: quote.source,
        offers: offersFor(quote, { lat: customer.lat ?? config.demoCenter.lat, lng: customer.lng ?? config.demoCenter.lng })
          .slice(0, 5)
          .map((o) => ({
            karigar_id: o.karigar.id,
            shop: o.karigar.shop,
            rating: o.karigar.ratingCount ? o.karigar.rating : "new karigar, no ratings yet",
            distance_km: o.distanceKm,
            repair_price: o.price,
            pickup_fee: o.pickupFee,
            total: o.total,
            ready_in_days: o.readyInDays,
            best_value: Boolean(o.best),
          })),
      };
    }
    case "book_repair": {
      const familyPay = input.family_payer_name ? { name: String(input.family_payer_name), relation: String(input.family_payer_relation || "family") } : undefined;
      const order = await createOrder({ customer, quoteId: String(input.quote_id), karigarId: String(input.karigar_id), donation: input.add_tool_fund_donation ? 1 : 0, bookedBy: "agent", familyPay });
      const k = readDB().karigars.find((x) => x.id === order.karigarId);
      cards.push({ type: "booking", orderId: order.id, paypalOrderId: order.paypal.orderId, total: order.total, karigar: k?.shop ?? order.karigarId, status: order.status, familyPayer: familyPay?.name });
      return {
        order_id: order.id,
        paypal_order_id: order.paypal.orderId,
        total: order.total,
        status: order.status,
        pickup_window: pickupWindow(order),
        next_step: familyPay
          ? `Family Pay: share the payment link ${familyPayPath(order)} with ${familyPay.name}; they approve it with their own PayPal.`
          : "Customer must approve the payment with the PayPal button shown in the chat.",
      };
    }
    case "book_ghar_safai_basket": {
      const items = (input.items as { quote_id: string; karigar_id: string }[]).map((i) => ({ quoteId: i.quote_id, karigarId: i.karigar_id }));
      const familyPay = input.family_payer_name ? { name: String(input.family_payer_name), relation: String(input.family_payer_relation || "family") } : undefined;
      const order = await createBasketOrder({ customer, items, bookedBy: "agent", familyPay });
      cards.push({ type: "booking", orderId: order.id, paypalOrderId: order.paypal.orderId, total: order.total, karigar: `${order.jobs?.length} items · Ghar Safai`, status: order.status, familyPayer: familyPay?.name });
      return { order_id: order.id, items: order.jobs?.length, pickup_fee: order.pickupFee, total: order.total, pickup_window: pickupWindow(order), paypal_order_id: order.paypal.orderId, family_pay_link: familyPay ? familyPayPath(order) : undefined };
    }
    case "get_order_status": {
      return summariseOrder(ownOrder(input.order_id));
    }
    case "cancel_booking": {
      const o = await advance(ownOrder(input.order_id).id, "cancel");
      return { order_id: o.id, status: o.status };
    }
    case "raise_warranty_claim": {
      const o = await raiseComplaint(ownOrder(input.order_id).id, { issue: input.issue as Complaint["issue"], details: String(input.details ?? "") });
      const c = o.complaints[0];
      return { complaint_id: c.id, ai_review: c.ai, auto_refund_limit_usd: AUTO_REFUND_LIMIT };
    }
    case "issue_refund": {
      const before = ownOrder(input.order_id);
      const c = before?.complaints.find((x) => x.id === input.complaint_id);
      if (!before || !c) throw new FlowError("Complaint not found");
      if (!c.ai || c.ai.refundAmount <= 0) throw new FlowError("The AI review did not recommend a refund for this complaint");
      // Policy is enforced here in code, not only in the prompt.
      if (c.ai.refundAmount > AUTO_REFUND_LIMIT) return { escalated: true, reason: `Refund of $${c.ai.refundAmount.toFixed(2)} is above the $${AUTO_REFUND_LIMIT} agent limit; sent to the support desk.` };
      const o = await resolveComplaint(before.id, c.id, { action: "refund", amount: c.ai.refundAmount });
      const r = o.complaints.find((x) => x.id === c.id)?.resolution;
      cards.push({ type: "refund", orderId: o.id, amount: r?.amount ?? 0, refundId: r?.refundId });
      return { refunded: r?.amount, paypal_refund_id: r?.refundId };
    }
  }
  throw new FlowError(`Unknown tool ${name}`);
}

export async function agentTurn(input: { customer: Account; sessionId?: string; message: string; photo?: string; lang?: Lang }) {
  if (!aiEnabled()) {
    throw new FlowError(
      serviceProblems.ai ? "The AI assistant is off: Google didn't accept the Gemini key (see Admin > System check). The rest of Sudhaar works." : "The Repair Agent needs GEMINI_API_KEY. The rest of Sudhaar works without it.",
      503,
    );
  }
  const existing = input.sessionId ? sessions.get(input.sessionId) : undefined;
  const sessionId = existing && existing.accountId === input.customer.id ? input.sessionId! : crypto.randomUUID();
  const session = sessions.get(sessionId) ?? { messages: [], updatedAt: Date.now(), accountId: input.customer.id };
  sessions.set(sessionId, session);
  if (input.photo) session.photo = input.photo;
  // If this turn fails part-way, the conversation goes back to how it was, so the next message
  // doesn't inherit half a turn (e.g. a tool call with no result, which Gemini would reject).
  const rollback = session.messages.length;
  try {
    return await runTurn(session, sessionId, input);
  } catch (e) {
    session.messages.length = rollback;
    if (e instanceof FlowError) throw e;
    if (isRateLimit(e)) throw new FlowError("The AI is busy right now (usage limit reached). Please try again in a minute.", 429);
    if (isTimeout(e)) throw new FlowError("The AI took too long to reply. Please try again.", 504);
    if (isOverloaded(e)) throw new FlowError("The AI is very busy right now. Please try again in a minute.", 503);
    console.error("Repair Agent failed:", (e as Error).message);
    throw new FlowError("The AI couldn't answer just now. Please try again.", 502);
  }
}

/** The whole reply, including tool calls, must finish within this; the browser stops waiting soon after. */
const TURN_BUDGET_MS = 55_000;

async function runTurn(session: Session, sessionId: string, input: { customer: Account; message: string; photo?: string; lang?: Lang }) {
  const started = Date.now();
  const meta = langMeta(input.lang ?? "en");
  // The language the customer picked in the app wins; in English, mirror how they write (Hinglish, Hindi, Tamil…).
  const langNote =
    meta.code === "en"
      ? "\n\n[Reply in the same language and script the customer wrote this message in: English stays English, Hinglish in Roman letters stays Hinglish, Hindi in Devanagari stays Hindi, and so on. Show prices in rupees (₹).]"
      : `\n\n[The customer's app is set to ${meta.english}: reply in simple ${meta.english} (${meta.native} script), even if they type in English. Show prices in rupees (₹).]`;
  session.messages.push({ role: "user", parts: [{ text: `${input.message}${input.photo ? "\n\n[Customer attached a photo of the item]" : ""}${langNote}` }] });

  const tk = paypalToolkit();
  const ppTools: FunctionDeclaration[] = (tk?.getTools() ?? []).map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    parametersJsonSchema: geminiSchema(t.function.parameters ?? { type: "object", properties: {} }),
  }));
  const ppToolNames = new Set(ppTools.map((t) => t.name));
  let tools = [...CUSTOM_TOOLS, ...ppTools];

  const cards: Card[] = [];
  const steps: { tool: string; ok: boolean; paypalToolkit: boolean }[] = [];

  for (let i = 0; i < 10; i++) {
    if (Date.now() - started > TURN_BUDGET_MS) return finish("Sorry, this is taking longer than usual. Please try again, or tell me a little more about the item.");
    let res;
    try {
      res = await generate({ model: config.ai.model, contents: session.messages, config: { systemInstruction: SYSTEM, tools: [{ functionDeclarations: tools }] } });
    } catch (e) {
      // If Gemini rejects a PayPal toolkit schema, carry on with Sudhaar's own tools instead of failing.
      if ((e as { status?: number }).status === 400 && tools.length > CUSTOM_TOOLS.length) {
        console.error("Gemini rejected the tool list; retrying without PayPal toolkit tools:", (e as Error).message);
        tools = CUSTOM_TOOLS;
        i--;
        continue;
      }
      throw e;
    }
    const turn = res.candidates?.[0]?.content;
    if (!turn?.parts?.length) return finish("Sorry, I can't help with that request.");
    session.messages.push({ role: "model", parts: turn.parts });

    const calls = res.functionCalls ?? [];
    if (calls.length === 0) return finish(res.text?.trim() || "Done.");

    const results: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const viaToolkit = ppToolNames.has(name);
      try {
        let out: unknown;
        if (viaToolkit && tk) {
          const r = await tk.handleToolCall({ id: call.id ?? crypto.randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } });
          out = r.content;
        } else {
          out = await runCustomTool(name, args, session, cards, input.customer);
        }
        steps.push({ tool: name, ok: true, paypalToolkit: viaToolkit });
        results.push({ functionResponse: { id: call.id, name, response: { output: asJson(out) } } });
      } catch (e) {
        steps.push({ tool: name, ok: false, paypalToolkit: viaToolkit });
        results.push({ functionResponse: { id: call.id, name, response: { error: (e as Error).message } } });
      }
    }
    session.messages.push({ role: "user", parts: results });
  }
  return finish("I hit my step limit for this request. Please try again with a little more detail.");

  function finish(reply: string) {
    session.updatedAt = Date.now();
    pruneSessions();
    return { sessionId, reply, cards, steps };
  }
}

/** The booked pickup (or visit) window in plain words, Indian time. */
const pickupWindow = (o: Order) => (o.pickupSlot ? slotLabel(o.pickupSlot, "en-IN", { today: "Today", tomorrow: "Tomorrow" }) : undefined);

/** Tool results go back to Gemini as JSON where possible. */
function asJson(out: unknown) {
  if (typeof out !== "string") return out;
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

function pruneSessions() {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [id, s] of sessions) if (s.updatedAt < cutoff) sessions.delete(id);
}
