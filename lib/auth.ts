import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { readDB, updateDB } from "./db";
import { FlowError } from "./orders";
import { hashPin, pinMatches } from "./pin";
import { rateLimit } from "./ratelimit";
import type { Account, Role } from "./types";

export { hashPin };

// Phone + PIN logins for customers, karigars, Saathis and admins.
// PINs are stored as scrypt hashes; sessions are HMAC-signed, HttpOnly cookies.
// Every API checks the role on the server, so hiding a page is never the only protection.

export const SESSION_COOKIE = "sudhaar_session";
const SESSION_DAYS = 30;

// ---------- PINs ----------

export const normalisePhone = (phone: unknown) => (typeof phone === "string" ? phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "") : "");
export const validPin = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4}$/.test(pin);

/** A random 4-digit PIN, avoiding obvious ones like 1111 or 1234. */
export function newPin() {
  for (;;) {
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    if (!/^(\d)\1{3}$/.test(pin) && !"0123456789".includes(pin) && !"9876543210".includes(pin)) return pin;
  }
}

// ---------- Sessions ----------

let secret: Buffer | null = null;
function sessionSecret() {
  if (secret) return secret;
  if (process.env.SESSION_SECRET) return (secret = Buffer.from(process.env.SESSION_SECRET));
  // No secret configured: keep a random one next to the data so logins survive restarts.
  const file = path.join(config.dataDir, ".session-secret");
  try {
    secret = fs.readFileSync(file);
  } catch {
    secret = crypto.randomBytes(32);
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  }
  return secret;
}

const sign = (data: string) => crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");

export function sessionCookie(account: Account) {
  const payload = Buffer.from(JSON.stringify({ a: account.id, e: Date.now() + SESSION_DAYS * 86400_000 })).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** The logged-in account for this request, or null. */
export function currentAccount(req: Request): Account | null {
  const raw = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { a: string; e: number };
    if (Date.now() > e) return null;
    return readDB().accounts.find((x) => x.id === a) ?? null;
  } catch {
    return null;
  }
}

/** Throws 401 when logged out and 403 for the wrong role. */
export function requireRole(req: Request, ...roles: Role[]): Account {
  const account = currentAccount(req);
  if (!account) throw new FlowError("Please log in to continue.", 401);
  if (!roles.includes(account.role)) throw new FlowError("This page is not available for your account.", 403);
  return account;
}

// ---------- Login and sign-up ----------

// Lock a phone number for 15 minutes after 5 wrong PINs, on top of the per-IP rate limit.
const failures = new Map<string, { count: number; until: number }>();

export function login(req: Request, input: { phone?: unknown; pin?: unknown }, roles: Role[]): Account {
  rateLimit(req, "login", 30);
  const phone = normalisePhone(input.phone);
  const lock = failures.get(phone);
  if (lock && lock.until > Date.now()) throw new FlowError("Too many wrong PINs. Please try again in 15 minutes.", 429);
  const account = readDB().accounts.find((a) => a.phone === phone && roles.includes(a.role));
  if (!account || typeof input.pin !== "string" || !pinMatches(input.pin, account.pinHash)) {
    // Keep counting until a lock has run out; then start fresh.
    const f = lock && !(lock.until && lock.until <= Date.now()) ? lock : { count: 0, until: 0 };
    f.count += 1;
    if (f.count >= 5) f.until = Date.now() + 15 * 60_000;
    failures.set(phone, f);
    throw new FlowError("Phone number or PIN is not right.", 401);
  }
  failures.delete(phone);
  return account;
}

export async function signUpCustomer(req: Request, input: { name?: unknown; phone?: unknown; pin?: unknown; address?: unknown }): Promise<Account> {
  rateLimit(req, "signup", 10);
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
  const phone = normalisePhone(input.phone);
  const address = typeof input.address === "string" ? input.address.trim().slice(0, 120) : "";
  if (!name) throw new FlowError("Please enter your name.");
  if (!/^[6-9]\d{9}$/.test(phone)) throw new FlowError("Please enter a valid 10-digit mobile number.");
  if (!validPin(input.pin)) throw new FlowError("Choose a 4-digit PIN.");
  const pinHash = hashPin(input.pin);
  return updateDB((db) => {
    if (db.accounts.some((a) => a.phone === phone && a.role === "customer")) throw new FlowError("This number already has an account. Please log in.", 409);
    const account: Account = {
      id: `C${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      role: "customer",
      name,
      phone,
      pinHash,
      createdAt: new Date().toISOString(),
      address: address || undefined,
      lat: config.demoCenter.lat,
      lng: config.demoCenter.lng,
    };
    db.accounts.push(account);
    return account;
  });
}

/** What the browser may know about the logged-in account. */
export function publicAccount(a: Account) {
  return { id: a.id, role: a.role, name: a.name, phone: `•••••• ${a.phone.slice(-4)}`, address: a.address, karigarId: a.karigarId, saathiId: a.saathiId, demo: a.demo ?? false };
}
export type PublicAccount = ReturnType<typeof publicAccount>;
