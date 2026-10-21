import { bypass, db } from "./db";
import type { EnvBag } from "./env";
import type { OrgContext } from "./org-context";
import { extractTenantSlug, rootDomain } from "./platform-domain";

/**
 * Decides which church a request belongs to.
 *
 * The hostname decides: not a header, not a query parameter, not a claim in a
 * cookie. A browser cannot choose which host its request arrived on, because
 * the certificate and the edge proxy already settled that.
 *
 * - **Hosted** (`PLATFORM_ROOT_DOMAIN` set): `{slug}-stewarddisplay.app.{root}`
 *   names the church. Any other host belongs to nobody.
 * - **Self-hosted**: the installation's one church, whatever the hostname.
 *   None yet means first-run setup; more than one means something went wrong,
 *   and guessing would be worse than failing.
 */
export type OrgResolution =
  | { kind: "org"; org: OrgContext }
  | { kind: "setup" }
  | { kind: "unknown-host" }
  | { kind: "ambiguous" };

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: OrgResolution; expiresAt: number }>();

/** More churches than one replica will ever serve; a bound, not a tuning knob. */
const MAX_CACHED = 5_000;

function sweep(): void {
  const now = Date.now();
  for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
  if (cache.size >= MAX_CACHED) cache.clear();
}

/** Forgets every cached answer. Called after setup creates the church. */
export function clearOrgCache(): void {
  cache.clear();
}

async function orgForSlug(slug: string): Promise<OrgResolution> {
  // Resolving which church a host belongs to is the one lookup that cannot
  // itself be church-scoped.
  const org = await db().org.findUnique(
    bypass({ where: { slug }, select: { id: true, slug: true, name: true, status: true } }),
  );
  if (!org || org.status !== "ACTIVE") return { kind: "unknown-host" };
  return { kind: "org", org: { orgId: org.id, slug: org.slug, name: org.name } };
}

async function soleOrg(): Promise<OrgResolution> {
  const orgs = await db().org.findMany(
    bypass({
      select: { id: true, slug: true, name: true },
      take: 2,
      orderBy: { createdAt: "asc" as const },
    }),
  );
  if (orgs.length === 0) return { kind: "setup" };
  if (orgs.length > 1) return { kind: "ambiguous" };
  const [org] = orgs;
  return { kind: "org", org: { orgId: org.id, slug: org.slug, name: org.name } };
}

export async function resolveOrg(
  host: string | null,
  env: EnvBag = process.env,
): Promise<OrgResolution> {
  const hosted = rootDomain(env) !== null;
  const slug = hosted ? extractTenantSlug(host, env) : null;
  if (hosted && !slug) return { kind: "unknown-host" };

  const key = slug ?? "(self-hosted)";
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = slug ? await orgForSlug(slug) : await soleOrg();
  // Only real churches are cached. Setup must end the moment it succeeds, and
  // caching misses would let a stream of random hostnames grow the map forever.
  if (value.kind === "org") {
    if (cache.size >= MAX_CACHED) sweep();
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return value;
}

export function isHosted(env: EnvBag = process.env): boolean {
  return rootDomain(env) !== null;
}
