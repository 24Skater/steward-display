/**
 * Entitlement enforcement for this app.
 *
 * Steward Display is open source and self-hostable. A church running its own copy has no
 * Steward console to ask, and must not be blocked by one — so when the platform
 * is not configured, every check passes and the app behaves exactly as it did
 * before the platform existed. Enforcement is opt-in by deployment, not by
 * default.
 *
 * When the platform *is* configured, the rules come from the decision record:
 *
 *   ACTIVE / GRACE  full access
 *   READ_ONLY       reads and exports yes, writes no
 *   REVOKED         no access
 *   (absent)        never subscribed to this product
 *
 * Reads survive almost everything on purpose. A church that has lapsed must
 * still be able to log in and export its data, and a console outage must never
 * stop a Sunday — see the fail-open behaviour in ./client.
 */

import { PlatformClient } from "./client";
import { type EntitlementState, canWrite } from "./entitlement-state";
import type { EnvBag } from "../env";

const PRODUCT = "display" as const;

export type EntitlementDecision =
  | { allow: true; state: EntitlementState | null; readOnly: boolean }
  | {
      allow: false;
      reason: "not_subscribed" | "revoked" | "read_only";
      state: EntitlementState | null;
    };

let client: PlatformClient | null | undefined;

/**
 * The shared client, or null when the platform is not configured.
 *
 * Built once and reused so the 60-second snapshot cache and the 24-hour JWKS
 * cache actually do their job; a per-request client would refetch both every
 * time and put the console on the critical path of every request.
 */
export function platformClient(env: EnvBag = process.env): PlatformClient | null {
  if (client !== undefined) return client;

  const consoleUrl = env.PLATFORM_CONSOLE_URL;
  const serviceToken = env.PLATFORM_SERVICE_TOKEN;

  client =
    consoleUrl && serviceToken
      ? new PlatformClient({
          consoleUrl,
          serviceToken,
          onWarning: (message, detail) => {
            console.warn(`[entitlements] ${message}`, detail);
          },
        })
      : null;

  return client;
}

/** Test seam. Production never calls this. */
export function resetPlatformClient(next?: PlatformClient | null): void {
  client = next;
}

/**
 * Decide whether a request may proceed.
 *
 * `isMutation` is the caller's judgement, because only the caller knows whether
 * this request intends to change anything. Middleware infers it from the HTTP
 * method; a server action would pass true.
 */
export async function checkEntitlement(
  orgId: string,
  isMutation: boolean,
  env: EnvBag = process.env,
): Promise<EntitlementDecision> {
  const platform = platformClient(env);

  // Self-hosted, or platform not wired up yet. Behave as if unmetered.
  if (!platform) return { allow: true, state: null, readOnly: false };

  let state: EntitlementState | undefined;
  try {
    state = await platform.getState(orgId, PRODUCT);
  } catch (error) {
    // The client already fails open for 24h against its cache and throws only
    // when it has never seen this org. Refusing here would lock out a church
    // whose first request of the day happened during a console outage, so the
    // request proceeds and the operator gets a log line.
    console.warn("[entitlements] No entitlement available; allowing the request.", error);
    return { allow: true, state: null, readOnly: false };
  }

  if (state === undefined) return { allow: false, reason: "not_subscribed", state: null };
  if (state === "REVOKED") return { allow: false, reason: "revoked", state };

  if (isMutation && !canWrite(state)) {
    return { allow: false, reason: "read_only", state };
  }

  return { allow: true, state, readOnly: !canWrite(state) };
}

/** HTTP methods that cannot change anything, and so are allowed while read-only. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isMutationMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}
