/**
 * Every hostname this app knows about, derived from one environment variable.
 *
 * The platform root domain is configuration, never a source constant;
 * `scripts/ci/check-platform-boundaries.sh` keeps it that way. Ported from
 * Congregation's `platform-domain.ts`.
 */
import type { EnvBag } from "./env";

/** The label this application answers to under the tenant root. */
export const APP_LABEL = "stewarddisplay";

const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** The platform root domain, or null on a self-hosted install. Null is not an error. */
export function rootDomain(env: EnvBag = process.env): string | null {
  const value = env.PLATFORM_ROOT_DOMAIN?.trim();
  return value ? value : null;
}

/**
 * The organization slug in a Host header, or null.
 *
 * Ports are stripped, case is ignored, and anything that is not exactly
 * `{slug}-stewarddisplay.app.{root}` returns null, including a host for a
 * different Steward application, which must not resolve here.
 */
export function extractTenantSlug(
  host: string | null | undefined,
  env: EnvBag = process.env,
): string | null {
  const root = rootDomain(env)?.split(":")[0].toLowerCase();
  if (!host || !root) return null;

  const hostname = host.split(":")[0].trim().toLowerCase();
  const suffix = `.app.${root}`;
  if (!hostname.endsWith(suffix)) return null;

  const label = hostname.slice(0, -suffix.length);
  const marker = `-${APP_LABEL}`;
  if (!label.endsWith(marker)) return null;

  const slug = label.slice(0, -marker.length);
  return isValidSlug(slug) ? slug : null;
}

/** Whether `slug` is one the console could have issued. */
export function isValidSlug(slug: string): boolean {
  return slug.length <= 63 && SLUG.test(slug);
}
