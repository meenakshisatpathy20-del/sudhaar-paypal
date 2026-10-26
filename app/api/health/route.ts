import { requireRole } from "@/lib/auth";
import { checkServices, lastHealth, storageStatus } from "@/lib/health";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// Admin System check: GET shows the last result, POST runs the checks again.
export async function GET(req: Request) {
  try {
    requireRole(req, "admin");
    return ok({ health: { ...(lastHealth() ?? (await checkServices())), storage: storageStatus() } });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    requireRole(req, "admin");
    return ok({ health: { ...(await checkServices()), storage: storageStatus() } });
  } catch (e) {
    return fail(e);
  }
}
