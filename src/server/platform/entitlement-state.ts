/**
 * The shape of an entitlement, as the Steward console issues it.
 *
 * This is the *reading* half of the contract and lives here, in this repository,
 * rather than in a package published for four apps to install. Two reasons, and
 * the second is the real one:
 *
 * 1. It is sixty lines that change about once a year. A published package would
 *    mean a version bump in four repositories every time a comment moved.
 * 2. **This repository has to be usable without the platform.** Steward Display is open
 *    source and self-hostable, and a dependency that only exists inside
 *    Steward's own registry would make `npm install` fail for anybody who is
 *    not Steward. Code you can only build with permission is not open source.
 *
 * Nothing here is a secret. It describes what a *client* checks, not what the
 * console decides — the issuing, the billing, and the pricing that produce these
 * states are the platform's business and are not in any public repository.
 *
 * Entitlements are keyed by plain product strings rather than by the console's
 * catalogue of product keys. This app only ever asks about itself, and knowing
 * the full catalogue would be knowing something it has no use for.
 */

export const ENTITLEMENT_STATES = ["ACTIVE", "GRACE", "READ_ONLY", "REVOKED"] as const;

export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

export interface Entitlement {
  state: EntitlementState;
  limits: Record<string, unknown>;
  /** Epoch seconds, or null when the entitlement has no deadline. */
  expiresAt: number | null;
}

export interface OrgSnapshot {
  id: string;
  slug: string;
  status: string;
}

export interface EntitlementSnapshot {
  org: OrgSnapshot;
  entitlements: Record<string, Entitlement | undefined>;
  /** When this snapshot was produced, epoch millis. */
  fetchedAt: number;
  /** Served from cache because a refresh failed. The states are still the real ones. */
  stale: boolean;
  /**
   * The outage outlasted the fail-open window, so states have been clamped to
   * READ_ONLY. Worth alerting on: it means this app has been cut off from the
   * console for a full day.
   */
  degraded: boolean;
}

/** ACTIVE and GRACE may write. READ_ONLY may not - that is the whole point of it. */
export function canWrite(state: EntitlementState | undefined): boolean {
  return state === "ACTIVE" || state === "GRACE";
}

/** Everything except REVOKED may read, so a lapsed org can still export its data. */
export function canRead(state: EntitlementState | undefined): boolean {
  return state !== undefined && state !== "REVOKED";
}
