#!/usr/bin/env node
/**
 * Applies prisma/migrations to DATABASE_URL, the way `prisma migrate deploy`
 * does, without shipping the Prisma CLI (and its 250 MB of studio tooling) in
 * the production image.
 *
 * It keeps Prisma's own `_prisma_migrations` table, with the same columns and
 * the same checksum (SHA-256 of migration.sql), so `prisma migrate status` on a
 * developer's machine agrees with what this applied, and either tool can take
 * over from the other.
 *
 *   node migrate.mjs [migrationsDir]
 */
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

const dir = resolve(process.argv[2] ?? "prisma/migrations");
// The advisory lock key Prisma Migrate itself takes, so the two never run at once.
const LOCK_KEY = 72707369;

const migrations = readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "migration.sql")))
  .map((entry) => entry.name)
  .sort();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )`);

  const { rows } = await client.query(
    'SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" WHERE rolled_back_at IS NULL',
  );
  const recorded = new Map(rows.map((row) => [row.migration_name, row]));

  let applied = 0;
  for (const name of migrations) {
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const row = recorded.get(name);

    if (row?.finished_at) {
      if (row.checksum !== checksum) {
        throw new Error(`${name} was edited after it was applied. Migrations are append-only.`);
      }
      continue;
    }
    if (row) {
      throw new Error(
        `${name} is recorded as started but not finished, by an earlier \`prisma migrate\` run. ` +
          `Check the database by hand. If none of it applied, remove the record so it runs again: ` +
          `DELETE FROM "_prisma_migrations" WHERE migration_name = '${name}' AND finished_at IS NULL; ` +
          `if all of it applied, mark it done: UPDATE "_prisma_migrations" SET finished_at = now() ` +
          `WHERE migration_name = '${name}' AND finished_at IS NULL; then start again.`,
      );
    }

    // The record and the migration commit together, or not at all: a crash at
    // any point leaves either a finished migration or no trace of the attempt.
    try {
      await client.query("BEGIN");
      await client.query(
        'INSERT INTO "_prisma_migrations" (id, checksum, migration_name) VALUES ($1, $2, $3)',
        [randomUUID(), checksum, name],
      );
      await client.query(sql);
      await client.query(
        'UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE migration_name = $1 AND finished_at IS NULL',
        [name],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`Migration ${name} failed and was rolled back: ${error?.message ?? error}`);
    }
    applied++;
    console.log(`Applied ${name}`);
  }
  console.log(
    applied === 0 ? "Database schema is up to date." : `Applied ${applied} migration(s).`,
  );
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end();
}
