import { requireRole } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { round2 } from "@/lib/pricing";
import { publicKarigar } from "@/lib/privacy";
import { liveLocation } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// Karigar / Saathi dashboard: profile, online status, earnings from real PayPal payouts, stats,
// reviews and the last 7 days. Admins can open any partner's view with ?id=.
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
        .map((p) => {
          // A thank-you tip has its own PayPal payout batch and date.
          const tip = p.kind === "tip" ? o.tips?.find((x) => x.status === "paid" && x.karigarId === p.partnerId && x.amount === p.amount) : undefined;
          return {
            orderId: o.id,
            item: o.kind === "basket" ? `Ghar Safai basket (${o.jobs?.length} items)` : o.item,
            amount: p.amount,
            status: p.status,
            tip: Boolean(tip),
            batchId: tip ? tip.payoutBatchId : o.paypal.payoutBatchId,
            at: tip?.paidAt ?? o.events.findLast((e) => e.status === "paid_out")?.at ?? o.createdAt,
          };
        }),
    );

    // Orders this partner worked on.
    const mine = db.orders.filter((o) => (karigar ? o.karigarId === id || o.jobs?.some((j) => j.karigarId === id) : o.saathiId === id && o.mode === "pickup"));
    const finished = mine.filter((o) => ["delivered", "paid_out"].includes(o.status));
    const active = mine.filter((o) => !["awaiting_payment", "cancelled", "delivered", "paid_out"].includes(o.status));

    // Last 7 days of payouts, oldest first, for the earnings chart.
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400_000);
      return d.toISOString().slice(0, 10);
    });
    const week = days.map((day) => ({ day, amount: round2(earnings.filter((e) => e.at.slice(0, 10) === day).reduce((s, e) => s + e.amount, 0)) }));

    const reviews = karigar
      ? mine
          .flatMap((o) => (o.ratings ?? []).filter((r) => r.karigarId === id).map((r) => ({ orderId: o.id, item: o.item, stars: r.stars, text: r.text, at: r.at, by: o.customer.name.split(" ")[0] })))
          .sort((a, b) => b.at.localeCompare(a.at))
      : [];
    const tips = round2(earnings.filter((e) => e.tip).reduce((s, e) => s + e.amount, 0));
    const loc = saathi ? liveLocation(db, saathi.id) : undefined;

    return ok({
      role: karigar ? "karigar" : "saathi",
      profile: karigar
        ? publicKarigar(karigar)
        : { id: saathi!.id, name: saathi!.name, rating: saathi!.rating, area: saathi!.area ?? "", vehicle: saathi!.vehicle ?? "bicycle" },
      online: !(db.offline ?? []).includes(id!),
      earnings: earnings.sort((a, b) => b.at.localeCompare(a.at)),
      totalEarned: round2(earnings.reduce((s, e) => s + e.amount, 0)),
      stats: {
        active: active.length,
        finished: finished.length,
        tips,
        weekTotal: round2(week.reduce((s, d) => s + d.amount, 0)),
        // Saathis: kilometres ridden on finished trips (there and back for each leg).
        km: saathi ? round2(finished.reduce((s, o) => s + o.distanceKm * 2, 0)) : undefined,
        avgStars: reviews.length ? round2(reviews.reduce((s, r) => s + r.stars, 0) / reviews.length) : null,
      },
      week,
      reviews,
      sharingLocation: loc ? { at: loc.at, simulated: Boolean(loc.simulated), lat: loc.lat, lng: loc.lng } : null,
      // Admin-only: the list to switch between partners.
      partners: account.role === "admin" ? { karigars: db.karigars.map((k) => ({ id: k.id, name: `${k.shop} (${k.name})` })), saathis: db.saathis.map((s) => ({ id: s.id, name: s.name })) } : undefined,
    });
  } catch (e) {
    return fail(e);
  }
}
