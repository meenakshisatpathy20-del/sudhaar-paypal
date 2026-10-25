import { publicAccount, requireRole } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";
import { maskPhone } from "@/lib/sms";
import { isOpenClaim } from "@/lib/claims-shared";

export const dynamic = "force-dynamic";

// Admin: everything about one customer on one screen: calls (with transcripts), SMS, orders,
// claims and callback requests. Look up by phone number, account id, name or order number.
export function GET(req: Request) {
  try {
    requireRole(req, "admin");
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 3) throw new FlowError("Type a phone number, name or order number.");
    const db = readDB();
    const digits = q.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    const byOrder = db.orders.find((o) => o.id === q.toUpperCase())?.customerId;
    const customers = db.accounts.filter(
      (a) => a.role === "customer" && (a.id === q || a.id === byOrder || (digits.length >= 4 && a.phone.endsWith(digits)) || a.name.toLowerCase().includes(q.toLowerCase())),
    );
    if (!customers.length) throw new FlowError("No customer found.", 404);
    // Several matches (e.g. two people named Kamla): show the one with the most recent activity.
    const lastActive = (id: string) => db.orders.filter((o) => o.customerId === id).reduce((m, o) => (o.createdAt > m ? o.createdAt : m), "");
    customers.sort((x, y) => lastActive(y.id).localeCompare(lastActive(x.id)) || y.createdAt.localeCompare(x.createdAt));
    const a = customers[0];
    const orders = db.orders.filter((o) => o.customerId === a.id);
    const ids = new Set(orders.map((o) => o.id));
    const calls = (db.voiceCalls ?? []).filter((c) => c.customerId === a.id || c.to === a.phone || (c.from && c.from.replace(/\D/g, "").endsWith(a.phone)) || c.orderIds?.some((x) => ids.has(x)));
    const sms = (db.smsLog ?? []).filter((m) => m.accountId === a.id || (m.orderId && ids.has(m.orderId)));
    const callbacks = (db.callbacks ?? []).filter((c) => c.customerId === a.id || c.phone === a.phone);
    const claims = orders.flatMap((o) => o.complaints.map((c) => ({ id: c.id, orderId: o.id, issue: c.issue, status: c.status ?? (c.resolution ? "resolved" : "open"), open: isOpenClaim(c), createdAt: c.createdAt, channel: c.channel })));
    // One timeline, newest first: what the team needs before calling them back.
    const timeline = [
      ...orders.map((o) => ({ at: o.createdAt, kind: "order", text: `${o.bookedBy === "phone" ? "Phone booking" : "Booking"} ${o.id}: ${o.item} · ${o.status.replaceAll("_", " ")}`, ref: o.id })),
      ...claims.map((c) => ({ at: c.createdAt, kind: "claim", text: `Claim ${c.id} (${c.issue.replaceAll("_", " ")}) · ${c.status.replaceAll("_", " ")}${c.channel === "phone" ? " · by phone" : ""}`, ref: c.id })),
      ...calls.map((c) => ({ at: c.at, kind: "call", text: `${c.direction === "outbound" ? `Call to them (${c.reason?.replaceAll("_", " ") ?? "outbound"})` : "They called"} · ${c.status ?? "—"}${c.durationSec ? ` · ${c.durationSec}s` : ""}${c.summary ? ` · ${c.summary}` : ""}`, ref: c.id })),
      ...sms.map((m) => ({ at: m.at, kind: "sms", text: `SMS ${m.kind.replaceAll("_", " ")} to ${m.to} · ${m.status}: ${m.text}`, ref: m.id })),
      ...callbacks.map((c) => ({ at: c.at, kind: "callback", text: `Asked for a person: ${c.reason} · ${c.status}`, ref: c.id })),
    ].sort((x, y) => y.at.localeCompare(x.at));
    return ok({
      customer: { ...publicAccount(a), phone: maskPhone(a.phone), viaPhone: Boolean(a.viaPhone), address: a.address ?? "" },
      more: customers.length - 1,
      stats: { orders: orders.length, openClaims: claims.filter((c) => c.open).length, calls: calls.length, sms: sms.length, openCallbacks: callbacks.filter((c) => c.status === "open").length },
      calls: calls.map((c) => ({ ...c, from: c.from ? maskPhone(c.from.replace(/\D/g, "")) : c.from })),
      timeline,
    });
  } catch (e) {
    return fail(e);
  }
}
