import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { decidePriceChange, getOrder } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";

// Customer: approve or decline the karigar's price change. Nothing changes without this.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const customer = requireRole(req, "customer");
    const { id } = await params;
    assertCanView(customer, getOrder(id));
    const { approve } = (await req.json()) as { approve: boolean };
    return ok({ order: orderFor(customer, await decidePriceChange(id, Boolean(approve))) });
  } catch (e) {
    return fail(e);
  }
}
