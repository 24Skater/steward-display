import { describe } from "vitest";

import { bypass, db } from "@/server/db";
import { runInOrg, type OrgContext } from "@/server/org-context";

/** `describe` for tests that need Postgres; skipped when there is none. */
export const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Empties every table. Each integration file calls it before each test. */
export async function resetDatabase(): Promise<void> {
  await db().$executeRawUnsafe(
    'TRUNCATE "Pairing", "Device", "Preset", "OrgSettings", "Screen", "Session", "Membership", "User", "Org" CASCADE',
  );
}

let counter = 0;

/** A church, created outside any church's scope, as provisioning would. */
export async function makeOrg(name = "Grace Church"): Promise<OrgContext> {
  counter++;
  const org = await db().org.create(
    bypass({ data: { name, slug: `church-${counter}-${Date.now()}` } }),
  );
  return { orgId: org.id, slug: org.slug, name: org.name };
}

/** Runs `fn` as a request to `org` would. */
export function asOrg<T>(org: OrgContext, fn: () => Promise<T>): Promise<T> {
  return runInOrg(org, fn);
}
