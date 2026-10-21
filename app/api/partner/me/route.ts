import { requireRole } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { publicKarigar } from "@/lib/privacy";

export const dynamic = "force-dynamic";

// Karigar / Saathi dashboard: profile, online status and earnings from real PayPal payouts.
// Admins can open any partner's view with ?id=.
export function GET(req: Request) {
  try {
    const account = requireRole(req, "karigar", "saathi", "admin");
    const db = readDB();
    const asked = new URL(req.url).searchParams.get("id");
    const id = account.role === "admin" ? asked : (account.karigarId ?? account.saathiId);
    const karigar = db.karigars.find((k) => k.id === id);
    const saathi = db.saathis.find((s) => s.id === id);
    if (!karigar && !saathi) throw new FlowError(account.role === "admin" ? "Pick a karigar or Saathi" : "Profile not found", 404);
    const label = karigar?.shop ?? saathi!.name;
    const earnings = db.orders.flatMap((o) =>
      o.payouts
        .filter((p) => (p.partnerId ? p.partnerId === id : p.label === label))
        .map((p) => ({ orderId: o.id, item: o.kind === "basket" ? `Ghar Safai basket (${o.jobs?.length} items)` : o.item, amount: p.amount, status: p.status, batchId: o.paypal.payoutBatchId, at: o.events.findLast((e) => e.status === "paid_out")?.at ?? o.createdAt })),
    );
    return ok({
      role: karigar ? "karigar" : "saathi",
      profile: karigar ? publicKarigar(karigar) : { id: saathi!.id, name: saathi!.name, rating: saathi!.rating },
      online: !(db.offline ?? []).includes(id!),
      earnings: earnings.sort((a, b) => b.at.localeCompare(a.at)),
      totalEarned: Math.round(earnings.reduce((s, e) => s + e.amount, 0) * 100) / 100,
      // Admin-only: the list to switch between partners.
      partners: account.role === "admin" ? { karigars: db.karigars.map((k) => ({ id: k.id, name: `${k.shop} (${k.name})` })), saathis: db.saathis.map((s) => ({ id: s.id, name: s.name })) } : undefined,
    });
  } catch (e) {
    return fail(e);
  }
}
