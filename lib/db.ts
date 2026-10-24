import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { hashPin } from "./pin";
import { demoAccountSpecs, demoPinFor, seedCoupons, seedDB, seedKarigars, seedSaathis } from "./seed";
import type { DB } from "./types";

// A tiny JSON-file store. It keeps the project dependency-free and easy for judges
// to run. The file is (re)seeded automatically, so a fresh deploy always has demo data.

const file = () => path.join(config.dataDir, "db.json");

let cache: DB | null = null;
let queue: Promise<unknown> = Promise.resolve();

function load(): DB {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(file(), "utf8")) as DB;
    // Seeded karigars and Saathis are demo data: always refresh them from the seed so profile
    // updates and the payout emails from .env apply to an existing database too. Karigars who
    // joined through onboarding are real records and are kept.
    cache.karigars = [...seedKarigars(), ...(cache.karigars ?? []).filter((k) => k.onboarded)];
    cache.saathis = [...seedSaathis(), ...(cache.saathis ?? []).filter((s) => s.onboarded)];
    cache.applications ??= [];
    cache.accounts ??= [];
    cache.coupons ??= seedCoupons();
    if (ensureDemoAccounts(cache)) persist(cache);
  } catch {
    cache = seedDB();
    ensureDemoAccounts(cache);
    persist(cache);
  }
  return cache;
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
}

export function readDB(): DB {
  return load();
}

/** Serialises writes so concurrent requests cannot clobber each other. */
export function updateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = load();
    const result = await fn(db);
    persist(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Clears orders and test data. Customer sign-ups and onboarded karigars are kept. */
export function resetDB() {
  const keep = cache ? { accounts: cache.accounts, karigars: cache.karigars.filter((k) => k.onboarded), saathis: cache.saathis.filter((x) => x.onboarded), applications: cache.applications, care: cache.care } : null;
  cache = seedDB();
  if (keep) {
    cache.accounts = keep.accounts;
    cache.karigars.push(...keep.karigars);
    cache.saathis.push(...keep.saathis);
    cache.applications = keep.applications;
    // The PayPal billing plan for Sudhaar Care stays valid across a demo reset; the shared demo
    // customer's own membership is cleared so the next judge starts fresh.
    cache.care = keep.care;
    for (const a of cache.accounts) if (a.demo) delete a.care;
  }
  ensureDemoAccounts(cache);
  persist(cache);
}

export function uploadsDir() {
  const dir = path.join(config.dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
