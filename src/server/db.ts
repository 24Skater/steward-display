import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { UserError } from "./errors";
import { currentOrgId } from "./org-context";
import { checkEntitlement } from "./platform/entitlements";
import { requiresWriteEntitlement } from "./platform/write-policy";
import { applyOrgScope } from "./tenancy";

/** What a person sees when their church's subscription has lapsed to read-only. */
export const READ_ONLY_MESSAGE =
  "This church's Steward Display subscription is read-only, so nothing can be changed. " +
  "Screens keep playing. Renew it in the Steward console to make changes again.";

/**
 * The database client, with tenancy enforced inside it.
 *
 * Every query against a model holding a church's data is scoped to the
 * organization in context, and every row created is stamped with it. A query
 * with no organization in context throws rather than returning every church's
 * rows: forgetting is a loud error, not a leak.
 *
 * `bypass()` is the escape hatch for the few operations that are about the
 * installation rather than a church. Each use says which.
 *
 * Nested writes (a `create` inside another model's `data`) are invisible to a
 * query extension. Nothing here uses them on tenanted models; keep it so.
 *
 * Writes are also checked against the church's Steward entitlement here, so
 * "a read-only church cannot change anything" is a property of the data layer
 * rather than something every server function has to remember. Which writes
 * a read-only church may still make is in `platform/write-policy.ts`. With no
 * Steward console configured (self-hosted) the check allows everything.
 * A bypassed write made inside a church's request is checked too: renaming
 * the church is one.
 */
function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const bag = args as Record<string, unknown> & { _bypassOrgScope?: boolean };
          const orgId = currentOrgId();
          if (bag?._bypassOrgScope === true) {
            delete bag._bypassOrgScope;
          } else {
            applyOrgScope(model ?? "", operation, bag, orgId);
          }
          if (orgId && requiresWriteEntitlement(model ?? "", operation, bag)) {
            const decision = await checkEntitlement(orgId, true);
            if (!decision.allow) throw new UserError(READ_ONLY_MESSAGE, 403);
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { stewardDisplayDb?: ExtendedClient };

/**
 * The client, created on first use so that importing this module never needs a
 * database. Cast back to PrismaClient so model accessors keep their argument
 * types; the runtime value is the extended client.
 */
export function db(): PrismaClient {
  if (!globalForPrisma.stewardDisplayDb) {
    globalForPrisma.stewardDisplayDb = createPrismaClient();
  }
  return globalForPrisma.stewardDisplayDb as unknown as PrismaClient;
}

/**
 * Marks query arguments as deliberately unscoped. Returns the same type it
 * receives, so call sites keep Prisma's checking.
 */
export function bypass<T extends object>(args: T): T {
  return { ...args, _bypassOrgScope: true } as T;
}

/**
 * A value that came out of a zod schema as JSON-shaped data, typed for a Prisma
 * `Json` column. Zod's `Record<string, unknown>` is not provably JSON to
 * TypeScript; every caller has just parsed it from JSON, so it is.
 */
export function asJson(value: object): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}
