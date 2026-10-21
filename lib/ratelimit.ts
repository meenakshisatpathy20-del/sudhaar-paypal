import { FlowError } from "./orders";

// Tiny in-memory rate limiter, so a public demo can't be used to burn through AI credits.
const hits = new Map<string, number[]>();

export function rateLimit(req: Request, bucket: string, max: number, windowMs = 10 * 60 * 1000) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new FlowError("You're going a bit fast. Please wait a few minutes and try again.", 429);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
}
