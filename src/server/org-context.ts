import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The organization the current request belongs to.
 *
 * Set once per request by `src/server.ts`, from the hostname, and read by the
 * database guard in `db.ts`. Nothing below has to pass it along, because
 * passing it through every layer is how it ends up missing from one of them.
 * Ported from Congregation.
 */
export interface OrgContext {
  orgId: string;
  slug: string;
  name: string;
}

const storage = new AsyncLocalStorage<OrgContext>();

/** Runs `fn` with `context` visible to every database call it makes. */
export function runInOrg<T>(context: OrgContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The current organization, or null outside one. */
export function currentOrg(): OrgContext | null {
  return storage.getStore() ?? null;
}

export function currentOrgId(): string | null {
  return storage.getStore()?.orgId ?? null;
}

/** The current organization, or a thrown error for code that cannot proceed without one. */
export function requireOrg(): OrgContext {
  const org = currentOrg();
  if (!org) throw new Error("[Tenancy] No organization in context.");
  return org;
}

/**
 * `data` with the current church's id, for `create` calls. The guard would
 * stamp it anyway; naming it keeps Prisma's types honest, and the guard still
 * checks that it matches.
 */
export function inOrg<T extends object>(data: T): T & { orgId: string } {
  return { ...data, orgId: requireOrg().orgId };
}
