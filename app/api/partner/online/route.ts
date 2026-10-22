import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { setOnline } from "@/lib/orders";

// Karigars and Saathis switch themselves online/offline. Offline means no new jobs.
export async function POST(req: Request) {
  try {
    const account = requireRole(req, "karigar", "saathi");
    const { online } = (await req.json()) as { online: boolean };
    return ok({ online: await setOnline((account.karigarId ?? account.saathiId)!, Boolean(online)) });
  } catch (e) {
    return fail(e);
  }
}
