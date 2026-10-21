import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { aiEnabled, config } from "./config";
import { uploadsDir } from "./db";
import { REFERENCE, round2 } from "./pricing";
import type { Category, CompletionCheck, ItemSize, Order } from "./types";

// Claude powers three decisions in Sudhaar:
//   1. Snap & Quote   - photo -> item, damage, repair-cost range vs. new price
//   2. Completion check - before/after photos -> is the repair really done? (gates the PayPal capture)
//   3. Resolve Hub     - complaint + bill + photos -> re-repair / refund recommendation
// Without ANTHROPIC_API_KEY each falls back to a deterministic, clearly labelled simulation.

const CATEGORIES = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"] as const;

let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic());

type ImageBlock = Anthropic.Beta.BetaImageBlockParam;

function imageBlock(file?: string): ImageBlock[] {
  if (!file) return [];
  const safe = path.basename(file);
  const full = path.join(uploadsDir(), safe);
  if (!fs.existsSync(full)) return [];
  const ext = path.extname(safe).toLowerCase();
  const media_type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return [{ type: "image", source: { type: "base64", media_type, data: fs.readFileSync(full).toString("base64") } }];
}

async function ask<S extends z.ZodType>(schema: S, system: string, content: Anthropic.Beta.BetaContentBlockParam[], effort: "low" | "medium") {
  const res = await claude().beta.messages.parse({
    model: config.ai.model,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error(`Claude returned no structured output (stop_reason: ${res.stop_reason})`);
  }
  return res.parsed_output as z.infer<S>;
}

// ---------- 1. Snap & Quote ----------

const QuoteSchema = z.object({
  item: z.string().describe("Short name of the item, e.g. 'Mixer grinder jar'"),
  category: z.enum(CATEGORIES),
  size: z.enum(["small", "medium", "large"]).describe("small = fits in a bag, medium = needs two hands, large = furniture/appliance"),
  issue: z.string().describe("What is broken, in one plain sentence"),
  repairable: z.boolean(),
  repairLow: z.number().describe("Low end of a fair local repair price in USD"),
  repairHigh: z.number().describe("High end of a fair local repair price in USD"),
  newPrice: z.number().describe("Typical price of buying a comparable new item in USD; 0 for services like plumbing"),
  repairDays: z.number().describe("Typical turnaround in days (0 = same day)"),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().describe("One sentence the customer should know, e.g. what the karigar will confirm on inspection"),
});
export type QuoteResult = z.infer<typeof QuoteSchema> & { source: "claude" | "simulated"; warning?: string };

const QUOTE_SYSTEM = `You are the estimator for Sudhaar, a doorstep repair service that connects households with local informal repairers (karigars) such as cobblers, tailors and small-appliance repairers in Indian cities.
Given a photo and/or description of a broken household item, identify it and estimate a fair local repair price range.
Prices are in USD because payments run through the PayPal sandbox; convert from typical Indian street-repair rates (roughly 1 USD = 85 INR). Street repairs are cheap: a shoe sole is usually $2-5, a bag zip $2-4, a mixer coupler $3-7.
Be honest: if the item is clearly not worth repairing, set repairable=false. Never invent damage you cannot see; lower the confidence instead.
The estimate is a range; the karigar confirms the final price after inspecting the item.`;

export async function quoteItem(input: { photo?: string; description?: string; category?: Category }): Promise<QuoteResult> {
  if (aiEnabled()) {
    try {
      const out = await ask(
        QuoteSchema,
        QUOTE_SYSTEM,
        [
          ...imageBlock(input.photo),
          { type: "text", text: `Customer description: ${input.description?.trim() || "(none — use the photo)"}${input.category ? `\nCustomer says the item is in this category: ${input.category}` : ""}` },
        ],
        "low",
      );
      return { ...sanitiseQuote(out), source: "claude" };
    } catch (e) {
      return { ...simulateQuote(input.description, input.category), warning: `AI unavailable, used estimate table: ${(e as Error).message}` };
    }
  }
  return simulateQuote(input.description, input.category);
}

function sanitiseQuote(q: z.infer<typeof QuoteSchema>) {
  const low = Math.max(0.5, round2(Math.min(q.repairLow, q.repairHigh)));
  const high = Math.max(low, round2(Math.max(q.repairLow, q.repairHigh)));
  return { ...q, repairLow: low, repairHigh: high, newPrice: Math.max(0, round2(q.newPrice)), repairDays: Math.max(0, Math.round(q.repairDays)) };
}

const KEYWORDS: [Category, RegExp][] = [
  ["shoes", /shoe|sandal|sole|chappal|heel|boot|sneaker/i],
  ["bags", /bag|zip|backpack|purse|suitcase|strap/i],
  ["clothes", /shirt|kurta|saree|sari|pant|jeans|dress|stitch|button|hem|tear/i],
  ["electronics", /phone|mobile|screen|charger|laptop|earphone|headphone|remote|speaker/i],
  ["furniture", /chair|table|sofa|bed|cupboard|wood|drawer|shelf/i],
  ["plumbing", /tap|leak|pipe|flush|sink|drain|geyser/i],
  ["electrical", /switch|socket|wiring|light|fuse|mcb|bulb/i],
  ["small-appliance", /mixer|grinder|fan|iron|kettle|toaster|blender|cooler|jar/i],
];

const CATEGORY_NAME: Record<Category, string> = { shoes: "Footwear", bags: "Bag", clothes: "Clothing", "small-appliance": "Small appliance", electronics: "Phone / gadget", furniture: "Furniture", plumbing: "Plumbing job", electrical: "Electrical job" };

export function simulateQuote(description = "", hint?: Category): QuoteResult {
  const category = hint ?? KEYWORDS.find(([, re]) => re.test(description))?.[0] ?? "small-appliance";
  const ref = REFERENCE[category];
  const item = description.trim() ? description.trim().split(/[.,!\n]/)[0].slice(0, 60) : CATEGORY_NAME[category];
  return {
    item,
    category,
    size: ref.size as ItemSize,
    issue: description.trim() || "Needs inspection",
    repairable: true,
    repairLow: ref.repair[0],
    repairHigh: ref.repair[1],
    newPrice: ref.newPrice,
    repairDays: ref.days,
    confidence: "low",
    notes: "Simulated estimate from Sudhaar's price table (no AI key configured). The karigar confirms the final price on inspection.",
    source: "simulated",
  };
}

// ---------- 2. Completion check (gates the capture) ----------

const CompletionSchema = z.object({
  passed: z.boolean().describe("true only if the after photo plausibly shows the reported issue fixed on the same item"),
  reasoning: z.string().describe("One or two sentences"),
});

export async function checkCompletion(order: Order): Promise<CompletionCheck> {
  if (aiEnabled() && order.afterPhoto) {
    try {
      const out = await ask(
        CompletionSchema,
        "You verify repairs for Sudhaar before the customer's held PayPal payment is released to the karigar. Compare the BEFORE and AFTER photos. Pass only if the AFTER photo plausibly shows the same item with the reported problem fixed. If the before photo is missing, judge whether the after photo shows a sound, repaired item of the right kind.",
        [
          { type: "text", text: `Item: ${order.item}. Reported issue: ${order.issue}.` },
          { type: "text", text: "BEFORE photo:" },
          ...imageBlock(order.beforePhoto),
          { type: "text", text: "AFTER photo:" },
          ...imageBlock(order.afterPhoto),
        ],
        "low",
      );
      // A failed check also goes to a human, so a karigar is never stuck on an AI mistake.
      return { ...out, source: "claude", needsReview: !out.passed };
    } catch (e) {
      // Never release money on an error: hold the payment and ask a person to compare the photos.
      console.error("Completion check failed:", (e as Error).message);
      return { passed: false, needsReview: true, reasoning: "The AI photo check is unavailable right now.", source: "claude" };
    }
  }
  return {
    passed: Boolean(order.afterPhoto),
    reasoning: order.afterPhoto
      ? "Simulated check: after-photo uploaded by the karigar. (Add ANTHROPIC_API_KEY for a real before/after comparison.)"
      : "No after photo uploaded.",
    source: "simulated",
  };
}

// ---------- 3. Resolve Hub complaint review ----------

const ComplaintSchema = z.object({
  recommendation: z.enum(["re_repair", "partial_refund", "full_refund", "reject"]),
  refundAmount: z.number().describe("USD to refund to the customer; 0 for re_repair or reject"),
  reasoning: z.string().describe("Two or three sentences a support agent can read"),
});

export async function reviewComplaint(
  order: Order,
  complaint: { issue: string; details: string; photo?: string },
): Promise<{ recommendation: "re_repair" | "partial_refund" | "full_refund" | "reject"; refundAmount: number; reasoning: string; source: "claude" | "simulated" }> {
  const refundable = round2(order.total - order.paypal.refunds.reduce((s, r) => s + r.amount, 0));
  const clamp = (n: number) => Math.min(refundable, Math.max(0, round2(n)));
  if (aiEnabled()) {
    try {
      const bill = {
        order: order.id,
        item: order.item,
        issue: order.issue,
        repairCharge: order.repairCharge,
        pickupFee: order.pickupFee,
        totalPaid: order.total,
        refundableRemaining: refundable,
        deliveredAt: order.events.find((e) => e.status === "delivered")?.at,
        completionCheck: order.completionCheck,
        invoiceId: order.paypal.invoiceId,
      };
      const out = await ask(
        ComplaintSchema,
        `You are Sudhaar's Resolve Hub reviewer. Sudhaar gives a 15-day repair warranty. Policy:
- Same problem returned (repair_failed) within 15 days: prefer re_repair (free), or partial_refund of the repair charge if the customer does not want another repair.
- Item damaged in transit/at the karigar: full_refund, or partial_refund matching the damage.
- Overcharged vs. the locked quote: partial_refund of the difference.
- Delayed: small partial_refund of the pickup fee.
- Missing item: full_refund.
- Reject only if the evidence clearly contradicts the claim.
Never recommend more than refundableRemaining. Be fair to both the customer and the karigar.`,
        [
          { type: "text", text: `Digital bill (from the PayPal invoice):\n${JSON.stringify(bill, null, 2)}` },
          { type: "text", text: `Complaint type: ${complaint.issue}\nCustomer says: ${complaint.details}` },
          ...(order.afterPhoto ? [{ type: "text" as const, text: "Photo when delivered:" }, ...imageBlock(order.afterPhoto)] : []),
          ...(complaint.photo ? [{ type: "text" as const, text: "Customer's complaint photo:" }, ...imageBlock(complaint.photo)] : []),
        ],
        "medium",
      );
      return { ...out, refundAmount: out.recommendation === "re_repair" || out.recommendation === "reject" ? 0 : clamp(out.refundAmount), source: "claude" };
    } catch {
      // fall through to policy table
    }
  }
  const table: Record<string, { recommendation: "re_repair" | "partial_refund" | "full_refund"; amount: number }> = {
    repair_failed: { recommendation: "re_repair", amount: 0 },
    damaged: { recommendation: "full_refund", amount: refundable },
    overcharged: { recommendation: "partial_refund", amount: order.repairCharge * 0.2 },
    delayed: { recommendation: "partial_refund", amount: order.pickupFee },
    missing: { recommendation: "full_refund", amount: refundable },
  };
  const pick = table[complaint.issue] ?? table.repair_failed;
  return {
    recommendation: pick.recommendation,
    refundAmount: clamp(pick.amount),
    reasoning: "Simulated decision from Sudhaar's warranty policy table (add ANTHROPIC_API_KEY for an AI review of the bill and photos).",
    source: "simulated",
  };
}
