import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Render's free plan has no persistent disk: a restart (or a sleep) wipes data/db.json and the
// uploaded photos. With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set (Upstash's free
// Redis), every write is copied there (gzipped, a moment after it happens) and restored on start,
// so judges' bookings, claims and photos are still there the next day. Without them, nothing changes.

const KEY = "sudhaar:db";
const UPLOAD = (name: string) => `sudhaar:upload:${name}`;
const UPLOAD_TTL_S = 60 * 24 * 60 * 60;

const cfg = () => ({ url: (process.env.UPSTASH_REDIS_REST_URL ?? "").trim().replace(/\/$/, ""), token: (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim() });
export const snapshotsEnabled = () => Boolean(cfg().url && cfg().token);

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const { url, token } = cfg();
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(8000) });
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || json.error) throw new Error(json.error ?? `Upstash answered ${res.status}`);
  return json.result;
}

type State = { lastSavedAt: string | null; lastError: string | null; restoredAt: string | null };
// Shared through globalThis: Next.js loads instrumentation and the route handlers as separate bundles.
const g = globalThis as { __sudhaarSnapshot?: State };
export const snapshotState: State = (g.__sudhaarSnapshot ??= { lastSavedAt: null, lastError: null, restoredAt: null });

/** On start: if the saved copy is newer than the local file (or there is no local file), restore it. */
export async function restoreSnapshot(dataDir: string) {
  if (!snapshotsEnabled()) return false;
  try {
    const raw = (await redis(["GET", KEY])) as string | null;
    if (!raw) return false;
    const { savedAt, db } = JSON.parse(zlib.gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as { savedAt: string; db: unknown };
    const file = path.join(dataDir, "db.json");
    const localAt = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
    if (Date.parse(savedAt) <= localAt) return false;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db));
    snapshotState.restoredAt = new Date().toISOString();
    console.log(`[snapshot] restored data saved at ${savedAt}`);
    return true;
  } catch (e) {
    snapshotState.lastError = (e as Error).message;
    console.error("[snapshot] restore failed:", (e as Error).message);
    return false;
  }
}

let timer: NodeJS.Timeout | null = null;
let pending: (() => string) | null = null;

/** Called after every write; saves at most once every 1.5 s. */
export function scheduleSnapshot(serialise: () => string) {
  if (!snapshotsEnabled()) return;
  pending = serialise;
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const get = pending;
    pending = null;
    if (!get) return;
    try {
      const savedAt = new Date().toISOString();
      const body = zlib.gzipSync(`{"savedAt":"${savedAt}","db":${get()}}`).toString("base64");
      await redis(["SET", KEY, body]);
      snapshotState.lastSavedAt = savedAt;
      snapshotState.lastError = null;
    } catch (e) {
      snapshotState.lastError = (e as Error).message;
      console.error("[snapshot] save failed:", (e as Error).message);
    }
  }, 1500);
  timer.unref?.();
}

/** Photos are saved too (each under its own key, kept 60 days). */
export async function saveUpload(name: string, bytes: Buffer) {
  if (!snapshotsEnabled()) return;
  try {
    await redis(["SET", UPLOAD(name), bytes.toString("base64"), "EX", UPLOAD_TTL_S]);
  } catch (e) {
    console.error("[snapshot] photo save failed:", (e as Error).message);
  }
}

/** A photo missing on disk after a restart is fetched back from the saved copy. */
export async function loadUpload(name: string): Promise<Buffer | null> {
  if (!snapshotsEnabled()) return null;
  try {
    const raw = (await redis(["GET", UPLOAD(name)])) as string | null;
    return raw ? Buffer.from(raw, "base64") : null;
  } catch {
    return null;
  }
}
