/** Backslashes and control characters (tab, newline): what browsers rewrite in a URL. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const REWRITTEN_BY_BROWSERS = /[\\\u0000-\u001f]/;

/**
 * Only paths on this site, so a "come back to" address can never send someone
 * elsewhere after signing in. Resolved the way a browser would: `/\evil.com`
 * and a path with a tab in it both become `//evil.com` in a browser, so both
 * are refused. Shared by the sign-in page and the Steward ID callback.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || REWRITTEN_BY_BROWSERS.test(next)) return "/";
  try {
    const base = "http://this-site.invalid";
    const url = new URL(next, base);
    return url.origin === base && next.startsWith("/") ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
