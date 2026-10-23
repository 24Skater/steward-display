/**
 * Which database writes a READ_ONLY church may still make.
 *
 * READ_ONLY exists so a church whose subscription lapsed can still sign in,
 * look at what it made and take it away. Signing in and out writes a session
 * row, and a paired TV stamps `lastSeenAt` as it polls; refusing those would
 * turn "read-only" into "locked out" and "every lobby TV erroring". Everything
 * else is the church's content or configuration, and is refused.
 *
 * A person's own account (`user`, `usertoken`) is not the church's: changing a
 * password or resetting a forgotten one stays possible, because it is the
 * person's, and Display's people may belong to several churches.
 *
 * Pure, so the policy is tested without a database. The enforcement itself is
 * in `db.ts`.
 */

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/** Models whose writes never need an entitlement: see above. */
const ALWAYS_WRITABLE = new Set(["session", "user", "usertoken"]);

export function isWriteOperation(operation: string): boolean {
  return WRITE_OPERATIONS.has(operation);
}

/** Whether `data` sets nothing but a TV's last-seen time. */
function isHeartbeat(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const keys = Object.keys(data);
  return keys.length === 1 && keys[0] === "lastSeenAt";
}

/**
 * Whether this write needs the church to be allowed to write.
 *
 * Reads never do: READ_ONLY keeps reads by definition, and REVOKED is refused
 * for the whole request before any query runs (see `src/server.ts`).
 */
export function requiresWriteEntitlement(
  model: string,
  operation: string,
  args: Record<string, unknown> | undefined,
): boolean {
  if (!isWriteOperation(operation)) return false;
  const name = model.toLowerCase();
  if (ALWAYS_WRITABLE.has(name)) return false;
  if (name === "device" && (operation === "update" || operation === "updateMany")) {
    return !isHeartbeat(args?.data);
  }
  return true;
}
