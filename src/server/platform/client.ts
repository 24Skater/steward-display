import { type JSONWebKeySet, createLocalJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type {
  Entitlement,
  EntitlementSnapshot,
  EntitlementState,
  OrgSnapshot,
} from "./entitlement-state";

/**
 * Asks the Steward console what an organization is allowed to do.
 *
 * See `entitlement-state.ts` for why this lives in this repository rather than
 * in a published package. The short version: Steward Display must be installable and
 * runnable by somebody who has never heard of Steward.
 *
 * Two things make this safe to put on a request path:
 *
 * 1. **Verification is offline.** The entitlement token is a signed JWT checked
 *    against a JWKS cached for 24 hours. Checking an entitlement costs no
 *    network call.
 * 2. **It fails open, on purpose.** If the console is unreachable, the last
 *    valid entitlement keeps being honoured for 24 hours before degrading to
 *    read-only. A billing outage must never stop a church running Sunday
 *    check-in. Do not "fix" this into failing closed.
 *
 * A self-hosted install never constructs one of these at all — see
 * `platformClient()` in `entitlements.ts`, which returns null when no console
 * is configured.
 */

const TOKEN_AUDIENCE = "steward-apps";
const SIGNING_ALGORITHM = "EdDSA";

const DEFAULT_REFRESH_MS = 60_000;
const DEFAULT_JWKS_CACHE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FAIL_OPEN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5_000;

export class PlatformUnavailableError extends Error {
  constructor(orgId: string, cause?: unknown) {
    super(`The Steward console is unreachable and no cached entitlement exists for org ${orgId}.`);
    this.name = "PlatformUnavailableError";
    this.cause = cause;
  }
}

export interface PlatformClientOptions {
  /** Base URL of the console, e.g. https://console.example.org. */
  consoleUrl: string;
  /** This app's service token: stw_svc_<app>_<secret>. */
  serviceToken: string;
  fetch?: typeof globalThis.fetch;
  /** Injectable clock, in epoch millis. Tests pin it; production leaves it. */
  now?: () => number;
  refreshIntervalMs?: number;
  jwksCacheMs?: number;
  /**
   * How long to keep honouring a cached entitlement while the console is
   * unreachable. Past this, states clamp to READ_ONLY.
   */
  failOpenWindowMs?: number;
  requestTimeoutMs?: number;
  onWarning?: (message: string, detail?: unknown) => void;
}

interface CacheEntry {
  org: OrgSnapshot;
  entitlements: Record<string, Entitlement | undefined>;
  fetchedAt: number;
}

export class PlatformClient {
  private readonly consoleUrl: string;
  private readonly serviceToken: string;
  private readonly doFetch: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly refreshIntervalMs: number;
  private readonly jwksCacheMs: number;
  private readonly failOpenWindowMs: number;
  private readonly requestTimeoutMs: number;
  private readonly onWarning: (message: string, detail?: unknown) => void;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<EntitlementSnapshot>>();

  private jwks: JSONWebKeySet | null = null;
  private jwksFetchedAt = 0;

  constructor(options: PlatformClientOptions) {
    this.consoleUrl = stripTrailingSlashes(options.consoleUrl);
    this.serviceToken = options.serviceToken;
    this.doFetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? (() => Date.now());
    this.refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_MS;
    this.jwksCacheMs = options.jwksCacheMs ?? DEFAULT_JWKS_CACHE_MS;
    this.failOpenWindowMs = options.failOpenWindowMs ?? DEFAULT_FAIL_OPEN_MS;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onWarning = options.onWarning ?? (() => {});
  }

  /**
   * Current entitlements for an org.
   *
   * Served from cache within the refresh interval. Otherwise refreshed, and on
   * failure the cache is reused under the fail-open policy above. Throws only
   * when the console is unreachable *and* nothing has ever been cached - there
   * is genuinely no answer to give.
   */
  async getSnapshot(orgId: string): Promise<EntitlementSnapshot> {
    const cached = this.cache.get(orgId);
    const age = cached ? this.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;

    if (cached && age < this.refreshIntervalMs) {
      return { ...cached, stale: false, degraded: false };
    }

    // Collapse concurrent refreshes for the same org into one request.
    const existing = this.inFlight.get(orgId);
    if (existing) return existing;

    const request = this.refresh(orgId, cached).finally(() => this.inFlight.delete(orgId));
    this.inFlight.set(orgId, request);
    return request;
  }

  /** The effective state of one product for one org. */
  async getState(orgId: string, product: string): Promise<EntitlementState | undefined> {
    const snapshot = await this.getSnapshot(orgId);
    return snapshot.entitlements[product]?.state;
  }

  private async refresh(
    orgId: string,
    cached: CacheEntry | undefined,
  ): Promise<EntitlementSnapshot> {
    try {
      const entry = await this.fetchAndVerify(orgId);
      this.cache.set(orgId, entry);
      return { ...entry, stale: false, degraded: false };
    } catch (error) {
      if (!cached) throw new PlatformUnavailableError(orgId, error);

      const outage = this.now() - cached.fetchedAt;
      if (outage < this.failOpenWindowMs) {
        this.onWarning("Serving cached entitlements; the console is unreachable.", error);
        return { ...cached, stale: true, degraded: false };
      }

      this.onWarning(
        "Console unreachable beyond the fail-open window; degrading to read-only.",
        error,
      );
      return {
        ...cached,
        entitlements: clampToReadOnly(cached.entitlements),
        stale: true,
        degraded: true,
      };
    }
  }

  private async fetchAndVerify(orgId: string): Promise<CacheEntry> {
    const response = await this.request(
      `${this.consoleUrl}/v1/orgs/${encodeURIComponent(orgId)}/entitlements`,
      { headers: { authorization: `Bearer ${this.serviceToken}` } },
    );

    if (!response.ok) {
      throw new Error(`Entitlement request failed with ${response.status}.`);
    }

    const body = (await response.json()) as { token: string; issuer: string };
    const claims = await this.verify(body.token, body.issuer);

    return { org: claims.org, entitlements: claims.entitlements, fetchedAt: this.now() };
  }

  private async verify(token: string, issuer: string) {
    const kid = decodeProtectedHeader(token).kid;
    let jwks = await this.getJwks(false);

    // A kid we have never seen means the console rotated its signing key.
    // Refetch once rather than failing for the rest of the 24h cache window.
    if (kid && !jwks.keys.some((key) => key.kid === kid)) {
      jwks = await this.getJwks(true);
    }

    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      issuer,
      audience: TOKEN_AUDIENCE,
      algorithms: [SIGNING_ALGORITHM],
      currentDate: new Date(this.now()),
      clockTolerance: 30,
    });

    return payload as unknown as {
      org: OrgSnapshot;
      entitlements: Record<string, Entitlement | undefined>;
    };
  }

  private async getJwks(force: boolean): Promise<JSONWebKeySet> {
    const fresh = this.jwks !== null && this.now() - this.jwksFetchedAt < this.jwksCacheMs;
    if (!force && fresh && this.jwks) return this.jwks;

    const response = await this.request(`${this.consoleUrl}/.well-known/jwks.json`, {});
    if (!response.ok) {
      // Keys we already hold are better than none; a failed refetch is not a
      // reason to stop verifying tokens we can still verify.
      if (this.jwks) return this.jwks;
      throw new Error(`JWKS request failed with ${response.status}.`);
    }

    this.jwks = (await response.json()) as JSONWebKeySet;
    this.jwksFetchedAt = this.now();
    return this.jwks;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.doFetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url.slice(0, end);
}

function clampToReadOnly(
  entitlements: Record<string, Entitlement | undefined>,
): Record<string, Entitlement | undefined> {
  const clamped: Record<string, Entitlement | undefined> = {};
  for (const [key, value] of Object.entries(entitlements)) {
    if (!value) continue;
    // REVOKED stays revoked: an outage must not restore access somebody lost.
    clamped[key] = value.state === "REVOKED" ? value : { ...value, state: "READ_ONLY" };
  }
  return clamped;
}
