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

/** A TV's requests are a pairing secret or nothing at all. */
const TV_BODY_LIMIT = 4 * 1024;
/** The largest legitimate body: importing a browser's worth of screens. */
const BODY_LIMIT = 8 * 1024 * 1024;

/**
 * An HTTP status to refuse the request with because of its body size, or null.
 * Checked before anything parses the body, so a 60 MB POST costs nothing.
 * A chunked body of unknown length is refused: browsers always send a length.
 * No length and no chunking is an empty POST (curl sends those), and passes.
 */
export function bodySizeRefusal(request: Request): 411 | 413 | null {
  if (SAFE_METHODS.has(request.method) || !request.body) return null;
  const header = request.headers.get("content-length");
  if (header === null) return request.headers.has("transfer-encoding") ? 411 : null;
  const length = Number(header);
  if (!Number.isFinite(length) || length < 0) return 411;
  const limit = new URL(request.url).pathname.startsWith("/api/tv/") ? TV_BODY_LIMIT : BODY_LIMIT;
  return length > limit ? 413 : null;
}
