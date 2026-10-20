import { fail, ok } from "@/lib/http";
import { createQuote, FlowError, offersFor } from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { photo?: string; description?: string };
    if (!body.photo && !body.description?.trim()) throw new FlowError("Add a photo or describe what is broken");
    const quote = await createQuote({ photo: body.photo, description: body.description?.slice(0, 500) });
    return ok({ quote, offers: offersFor(quote) });
  } catch (e) {
    return fail(e);
  }
}
