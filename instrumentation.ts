// Runs once when the server starts: restore saved data (lib/snapshot.ts), check that PayPal and
// Gemini accept our keys (lib/health.ts), and start the conductor that sends reminders and places
// follow-up calls (lib/symphony.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { restoreSnapshot } = await import("./lib/snapshot");
  await restoreSnapshot(process.env.DATA_DIR ?? "./data");
  const { checkServices } = await import("./lib/health");
  checkServices().catch((e) => console.error("[health] start-up check failed:", (e as Error).message));
  const { startConductor } = await import("./lib/symphony");
  startConductor();
}
