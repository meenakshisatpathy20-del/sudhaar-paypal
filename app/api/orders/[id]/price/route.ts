import { assertCanView } from "@/lib/access";
import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getOrder, requestPriceChange } from "@/lib/orders";
import { orderFor } from "@/lib/privacy";

// Karigar app: after inspecting the item, propose a new price with a reason. The customer decides.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const karigar = requireRole(req, "karigar");
    const { id } = await params;
    assertCanView(karigar, getOrder(id));
    const body = (await req.json()) as { jobId?: string; newPrice: number; reason: string };
    return ok({ order: orderFor(karigar, await requestPriceChange(karigar.karigarId!, id, body)) });
  } catch (e) {
    return fail(e);
  }
}
