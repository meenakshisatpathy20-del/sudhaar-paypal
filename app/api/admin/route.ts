import { requireRole } from "@/lib/auth";
import { readDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { expireUnpaidOrders, impactStats } from "@/lib/orders";
import { adminKarigar } from "@/lib/privacy";

export const dynamic = "force-dynamic";

// Admin console data: everything, for signed-in admins only.
export async function GET(req: Request) {
  try {
    requireRole(req, "admin");
    await expireUnpaidOrders();
    const db = readDB();
    const accounts = db.accounts.map((a) => ({ id: a.id, role: a.role, name: a.name, phone: `•••••• ${a.phone.slice(-4)}`, createdAt: a.createdAt, demo: a.demo ?? false }));
    return ok({ orders: db.orders, karigars: db.karigars.map(adminKarigar), saathis: db.saathis, accounts, webhooks: db.webhooks.slice(-50).reverse(), impact: impactStats() });
  } catch (e) {
    return fail(e);
  }
}
