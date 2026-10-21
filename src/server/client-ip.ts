import type { EnvBag } from "./env";

/**
 * Who is asking, for rate limits.
 *
 * Without a proxy, the socket address is the truth and X-Forwarded-For is
 * whatever the client typed. Behind one (`TRUST_PROXY=true`), each proxy
 * appends the address it received from, so the trustworthy entry is counted
 * from the right: `TRUSTED_PROXY_HOPS` proxies (default 1) means the last
 * entry. The leftmost entry is the client's own claim and never trusted.
 */
export function clientIpFrom(
  socketIp: string | undefined,
  forwardedFor: string | null | undefined,
  env: EnvBag = process.env,
): string {
  if (env.TRUST_PROXY?.trim().toLowerCase() === "true" && forwardedFor) {
    const hops = Math.max(1, Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
    const entries = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const entry = entries[entries.length - hops];
    if (entry) return entry;
  }
  return socketIp || "unknown";
}
