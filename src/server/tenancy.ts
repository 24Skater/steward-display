/**
 * Which models hold a church's data, and which do not.
 *
 * The two sets must together name every model in the schema:
 * `tenancy.test.ts` reads the generated client's model list and fails if one is
 * missing, so a model added later cannot quietly default to "unguarded".
 * Ported from Congregation's `lib/tenancy.ts`. Display has no parent-scoped
 * models, so that third set does not exist here.
 */

/** Models carrying a non-nullable `orgId`. Reads are scoped, creates are stamped. */
export const TENANTED_MODELS = new Set([
  "device",
  "invitation",
  "membership",
  "orgsettings",
  "pairing",
  "preset",
  "screen",
  "session",
]);

/**
 * Models that are not one church's data. `org` is the tenant root; `user` is
 * global because one person may serve several churches with one login, and the
 * church-shaped half of them is `membership`. `usertoken` (reset and
 * verification links) belongs to the person, not to a church.
 */
export const GLOBAL_MODELS = new Set(["org", "user", "usertoken"]);

const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Operations that select existing rows by `where` in order to change them. */
const WHERE_WRITE_OPS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

type Payload = Record<string, unknown> | undefined;

function createPayloads(operation: string, args: Record<string, unknown>): Payload[] {
  if (operation === "create") return [args.data as Payload];
  if (operation === "upsert") return [args.create as Payload];
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const data = args.data;
    return Array.isArray(data) ? (data as Payload[]) : [data as Payload];
  }
  return [];
}

/**
 * Narrows one database operation to one organization, in place.
 *
 * Reads and targeted writes gain `where.orgId`; created rows are stamped with
 * it. Anything not tenanted passes through, and anything nobody classified
 * throws: a new model is far more likely to be new tenant data than a new
 * global. Pure, so it is tested without a database.
 */
export function applyOrgScope(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  orgId: string | null,
): void {
  const name = model.toLowerCase();

  if (!TENANTED_MODELS.has(name)) {
    if (!GLOBAL_MODELS.has(name)) {
      throw new Error(
        `[Tenancy] ${model} is in neither TENANTED_MODELS nor GLOBAL_MODELS. ` +
          `Classify it in src/server/tenancy.ts.`,
      );
    }
    return;
  }

  if (!orgId) {
    throw new Error(
      `[Tenancy] ${operation} on ${model} with no organization in context. Requests get one ` +
        `from src/server.ts; work outside a request must use bypass() and say why.`,
    );
  }

  if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation) || operation === "upsert") {
    args.where = { ...((args.where as object) ?? {}), orgId };
  }

  // Moving a row to another church by rewriting its orgId is never right either.
  for (const payload of [args.data, operation === "upsert" ? args.update : undefined]) {
    if (!WHERE_WRITE_OPS.has(operation) && operation !== "upsert") break;
    const moved = (payload as Payload)?.orgId;
    if (moved !== undefined && moved !== orgId) {
      throw new Error(
        `[Tenancy] ${operation} on ${model} tries to move rows to orgId ${String(moved)}.`,
      );
    }
  }

  for (const payload of createPayloads(operation, args)) {
    if (!payload) continue;
    const existing = payload.orgId;
    if (existing !== undefined && existing !== orgId) {
      throw new Error(
        `[Tenancy] ${operation} on ${model} carries orgId ${String(existing)} while the request ` +
          `belongs to ${orgId}. Writing into another organization is never right.`,
      );
    }
    payload.orgId = orgId;
  }
}
