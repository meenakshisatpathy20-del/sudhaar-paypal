import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { seedDB } from "./seed";
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
  } catch {
    cache = seedDB();
    persist(cache);
  }
  return cache;
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

export function resetDB() {
  cache = seedDB();
  persist(cache);
}

export function uploadsDir() {
  const dir = path.join(config.dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
