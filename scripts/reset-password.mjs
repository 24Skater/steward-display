#!/usr/bin/env node
/**
 * Sets a new password for an account, from the server, and signs that person
 * out everywhere. For a self-hosted church with no email set up: whoever runs
 * the server is the password reset.
 *
 *   docker compose exec app node tools/reset-password.mjs someone@church.org
 *   DATABASE_URL=... node scripts/reset-password.mjs someone@church.org
 *
 * Prints a new random password unless one is piped in on stdin. The hash format
 * matches src/server/password.ts; keep the two in step.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const N = 2 ** 15;
const R = 8;
const P = 1;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 64, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024,
  });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.trim();
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... node reset-password.mjs <email>");
  process.exit(2);
}

const supplied = await readStdin();
if (supplied && supplied.length < 10) {
  console.error("A password needs at least 10 characters.");
  process.exit(2);
}
const password = supplied || randomBytes(12).toString("base64url");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query('SELECT id FROM "User" WHERE email = $1', [email]);
  if (rows.length === 0) {
    console.error(`No account for ${email}.`);
    process.exitCode = 1;
  } else {
    const userId = rows[0].id;
    await client.query('UPDATE "User" SET "passwordHash" = $1 WHERE id = $2', [
      await hashPassword(password),
      userId,
    ]);
    const signedOut = await client.query('DELETE FROM "Session" WHERE "userId" = $1', [userId]);
    console.log(`Password reset for ${email}; signed out of ${signedOut.rowCount} browser(s).`);
    if (!supplied) console.log(`New password: ${password}`);
  }
} finally {
  await client.end();
}
