import { fail, ok } from "@/lib/http";
import { createQuote, FlowError, offersFor } from "@/lib/orders";
import { CATEGORY_LABEL } from "@/lib/pricing";
import { rateLimit } from "@/lib/ratelimit";
import type { Category } from "@/lib/types";

export async function POST(req: Request) {
  try {
    rateLimit(req, "quote", 40);
    const body = (await req.json()) as { photo?: string; description?: string; category?: string };
    if (!body.photo && !body.description?.trim()) throw new FlowError("Add a photo or describe what is broken");
    const category = body.category && body.category in CATEGORY_LABEL ? (body.category as Category) : undefined;
    const quote = await createQuote({ photo: body.photo, description: body.description?.slice(0, 500), category });
    return ok({ quote, offers: offersFor(quote) });
  } catch (e) {
    return fail(e);
  }
}
