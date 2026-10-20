import { readDB } from "@/lib/db";
import { ok } from "@/lib/http";
import { impactStats } from "@/lib/orders";

export const dynamic = "force-dynamic";

export function GET() {
  const db = readDB();
  return ok({ orders: db.orders, karigars: db.karigars, saathis: db.saathis, webhooks: db.webhooks.slice(-50).reverse(), impact: impactStats() });
}
