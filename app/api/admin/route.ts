import { readDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { expireUnpaidOrders, impactStats } from "@/lib/orders";
import { adminKarigar } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export async function GET() {
  await expireUnpaidOrders();
  const db = readDB();
  return ok({ orders: db.orders, karigars: db.karigars.map(adminKarigar), saathis: db.saathis, webhooks: db.webhooks.slice(-50).reverse(), impact: impactStats() });
}
