import type { EnvBag } from "./env";
import { APP_LABEL, rootDomain } from "./platform-domain";

/**
 * The address links in emails point to, or null when there is no trustworthy
 * one.
 *
 * Never the request's Host header. A self-hosted install answers any hostname,
 * so building a "reset your password" link from Host would let anyone who can
 * send a request choose where somebody else's reset link goes (password-reset
 * poisoning). On the hosted platform the church's address follows from its
 * slug; on a self-hosted install the operator states it in PUBLIC_URL.
 */
export function publicUrl(slug: string, env: EnvBag = process.env): string | null {
  const root = rootDomain(env);
  if (root) return `https://${slug}-${APP_LABEL}.app.${root.split(":")[0]}`;

  const configured = env.PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** A link into this app for `slug`, or null when publicUrl() has none. */
export function appLink(slug: string, path: string, env: EnvBag = process.env): string | null {
  const base = publicUrl(slug, env);
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : null;
}
