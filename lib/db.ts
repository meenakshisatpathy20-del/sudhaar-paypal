import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { scheduleSnapshot } from "./snapshot";
import { hashPin } from "./pin";
import { demoAccountSpecs, demoPinFor, seedCoupons, seedDB, seedKarigars, seedSaathis } from "./seed";
import type { DB } from "./types";

// A tiny JSON-file store. It keeps the project dependency-free and easy for judges
// to run. The file is (re)seeded automatically, so a fresh deploy always has demo data.

const file = () => path.join(config.dataDir, "db.json");

// One cache and one write queue per server process, shared through globalThis: Next.js loads
// instrumentation (the conductor) and the route handlers as separate bundles, and two copies of
// the database would overwrite each other's writes.
type Store = { cache: DB | null; queue: Promise<unknown> };
const store: Store = ((globalThis as { __sudhaarDB?: Store }).__sudhaarDB ??= { cache: null, queue: Promise.resolve() });

function load(): DB {
  if (store.cache) return store.cache;
  try {
    store.cache = JSON.parse(fs.readFileSync(file(), "utf8")) as DB;
    // Seeded karigars and Saathis are demo data: always refresh them from the seed so profile
    // updates and the payout emails from .env apply to an existing database too. Karigars who
    // joined through onboarding are real records and are kept.
    store.cache.karigars = [...seedKarigars(), ...(store.cache.karigars ?? []).filter((k) => k.onboarded)];
    store.cache.saathis = [...seedSaathis(), ...(store.cache.saathis ?? []).filter((s) => s.onboarded)];
    store.cache.applications ??= [];
    store.cache.accounts ??= [];
    store.cache.coupons ??= seedCoupons();
    if (ensureDemoAccounts(store.cache)) persist(store.cache);
  } catch {
    store.cache = seedDB();
    ensureDemoAccounts(store.cache);
    persist(store.cache);
  }
  return store.cache;
}

/** Adds any missing demo logins (hashing their PINs once). Returns true if something was added. */
function ensureDemoAccounts(db: DB) {
  let added = false;
  for (const spec of demoAccountSpecs()) {
    if (db.accounts.some((a) => a.id === spec.id)) continue;
    db.accounts.push({ ...spec, pinHash: hashPin(demoPinFor(spec.role)), createdAt: new Date().toISOString() });
    added = true;
  }
  return added;
}

function persist(db: DB) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = file() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, file());
  scheduleSnapshot(() => JSON.stringify(db));
}

export function readDB(): DB {
  return load();
}

/** Serialises writes so concurrent requests cannot clobber each other. */
export function updateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = store.queue.then(async () => {
    const db = load();
    const result = await fn(db);
    persist(db);
    return result;
  });
  store.queue = run.catch(() => undefined);
  return run;
}

/** Clears orders and test data. Customer sign-ups and onboarded karigars are kept. */
export function resetDB() {
  const keep = store.cache ? { accounts: store.cache.accounts, karigars: store.cache.karigars.filter((k) => k.onboarded), saathis: store.cache.saathis.filter((x) => x.onboarded), applications: store.cache.applications, care: store.cache.care } : null;
  store.cache = seedDB();
  if (keep) {
    store.cache.accounts = keep.accounts;
    store.cache.karigars.push(...keep.karigars);
    store.cache.saathis.push(...keep.saathis);
    store.cache.applications = keep.applications;
    // The PayPal billing plan for Sudhaar Care stays valid across a demo reset; the shared demo
    // customer's own membership is cleared so the next judge starts fresh.
    store.cache.care = keep.care;
    for (const a of store.cache.accounts) if (a.demo) delete a.care;
  }
  ensureDemoAccounts(store.cache);
  persist(store.cache);
}

export function uploadsDir() {
  const dir = path.join(config.dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
