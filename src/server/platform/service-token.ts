/**
 * Verifying calls from the Steward console.
 *
 * The console authenticates to this app as a machine, not as a user:
 *
 *   Authorization: Bearer stw_svc_display_<secret>
 *
 * Steward Display holds exactly one such secret - its own. A token issued to another
 * product is not accepted here, which is the point of issuing one per app: a
 * leak from Table cannot provision or read anything in Steward Display.
 *
 * This is deliberately a small local module rather than a shared package. It is
 * twenty lines, it changes approximately never, and depending on a published
 * package to answer "may this request in" would mean a version bump in four
 * repos every time the console's auth changed.
 */

import { timingSafeEqual } from "node:crypto";
import type { EnvBag } from "../env";

const EXPECTED_PREFIX = "stw_svc_display_";

/**
 * Compare without leaking content through timing.
 *
 * timingSafeEqual throws on a length mismatch, which is itself an oracle, so
 * unequal lengths short-circuit before it is called. A token's length is not a
 * secret; its bytes are.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * True when the request carries this app's platform service token.
 *
 * Returns false rather than throwing when the token is unconfigured: an app
 * deployed without PLATFORM_SERVICE_TOKEN should refuse platform calls, not
 * accept them and not crash on them.
 */
export function isPlatformRequest(
  authorizationHeader: string | null,
  env: EnvBag = process.env,
): boolean {
  const expected = env.PLATFORM_SERVICE_TOKEN;
  if (!expected || !expected.startsWith(EXPECTED_PREFIX)) return false;

  if (!authorizationHeader) return false;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return false;

  return constantTimeEquals(token, expected);
}
