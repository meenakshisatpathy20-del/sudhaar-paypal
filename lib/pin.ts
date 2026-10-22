import crypto from "node:crypto";

// PINs are only ever stored as salted scrypt hashes.

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function pinMatches(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(pin, Buffer.from(salt, "hex"), 32);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
