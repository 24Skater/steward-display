/**
 * Request checks that run before the app sees a request, in `src/server.ts`.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a state-changing request came from this site's own pages.
 *
 * The session cookie is SameSite=Lax, which already keeps it off cross-site
 * POSTs in every current browser. This is the second lock: a browser always
 * says where a request came from (`Sec-Fetch-Site`, or `Origin` on older ones),
 * and anything that is not this host is refused. A request with neither header
 * is not from a browser, so it carries no ambient cookie worth forging.
 */
export function isSameOriginWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Paths that work before a church exists: the setup page and what it loads. */
export function isSetupPath(pathname: string): boolean {
  return pathname === "/setup" || pathname.startsWith("/_serverFn/");
}
