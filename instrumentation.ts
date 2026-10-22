// Runs once when the server starts: check that PayPal and Gemini accept our keys (lib/health.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkServices } = await import("./lib/health");
  checkServices().catch((e) => console.error("[health] start-up check failed:", (e as Error).message));
}
