import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Bearer secrets: session cookies, device tokens and pairing poll secrets.
 *
 * Each is 32 random bytes, so a fast hash is the right one: there is nothing
 * to brute-force, and the database only ever holds the SHA-256. A stolen
 * database row cannot be replayed as a cookie or a TV.
 */
export function newSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time string comparison for values of public length. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Letters and digits a person reads off a TV across a room and types on a
 * phone: no 0/O, 1/I/L, 5/S, 2/Z, 8/B.
 */
export const PAIRING_ALPHABET = "34679ACDEFGHJKMNPQRTUVWXY";
export const PAIRING_CODE_LENGTH = 6;

export function newPairingCode(): string {
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return code;
}

/** What a person typed, folded to the form codes are stored in. */
export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
