import { requireRole } from "@/lib/auth";
import { readDB, updateDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { describePayPalError, getPayoutBatch } from "@/lib/paypal";

// "Check with PayPal": asks the Payouts API for the latest status of this partner's payout batches
// (PENDING -> SUCCESS, or UNCLAIMED if the email has no PayPal account yet) and saves it.
export async function POST(req: Request) {
  try {
    const account = requireRole(req, "karigar", "saathi", "admin");
    const id = account.karigarId ?? account.saathiId;
    const db = readDB();
    const orders = db.orders.filter((o) => o.paypal.payoutBatchId && o.payouts.some((p) => account.role === "admin" || p.partnerId === id));
    const batches = new Map<string, string>();
    for (const o of orders) {
      batches.set(o.paypal.payoutBatchId!, o.id);
      for (const t of o.tips ?? []) if (t.payoutBatchId) batches.set(t.payoutBatchId, o.id);
    }
    const results: { batchId: string; status: string; error?: string }[] = [];
    for (const batchId of [...batches.keys()].slice(0, 15)) {
      try {
        const b = await getPayoutBatch(batchId);
        results.push({ batchId, status: b.status });
      } catch (e) {
        results.push({ batchId, status: "UNKNOWN", error: describePayPalError(e).message });
      }
    }
    await updateDB((db2) => {
      for (const r of results) {
        if (r.status === "UNKNOWN") continue;
        for (const o of db2.orders) {
          const isMain = o.paypal.payoutBatchId === r.batchId;
          const tip = o.tips?.find((t) => t.payoutBatchId === r.batchId);
          for (const p of o.payouts) {
            if (isMain && p.kind !== "tip") p.status = r.status;
            if (tip && p.kind === "tip" && p.partnerId === tip.karigarId && p.amount === tip.amount) p.status = r.status;
          }
        }
      }
    });
    return ok({ checked: results.length, results });
  } catch (e) {
    return fail(e);
  }
}
