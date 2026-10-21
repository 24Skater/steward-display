import { deviceForToken, payloadForDevice } from "./devices";
import { UserError, toUserError } from "./errors";
import { collectPairing, startPairing } from "./pairing";
import { limits } from "./rate-limit";

/**
 * The TV's three HTTP endpoints, as plain Request -> Response functions.
 *
 * A TV is not a person: it authenticates with a bearer token from pairing,
 * never with the session cookie, and nothing here reads one. JSON in, JSON
 * out, `no-store` everywhere so no proxy keeps one church's screen for another.
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function errorResponse(error: unknown): Response {
  const userError = toUserError(error);
  return json({ error: userError.message }, userError.status);
}

/** Behind a proxy the socket address is the proxy's; see TRUST_PROXY in .env.example. */
export function requestIp(request: Request): string {
  if (process.env.TRUST_PROXY?.trim().toLowerCase() === "true") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return "direct";
}

function limit(request: Request, limiter = limits.tvPoll): void {
  const result = limiter.hit(requestIp(request));
  if (!result.ok) throw new UserError("Too many requests. The TV will retry shortly.", 429);
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

/** POST /api/tv/pair: a TV asks for a code to show. */
export async function handlePairStart(request: Request): Promise<Response> {
  try {
    limit(request, limits.pairStart);
    return json(await startPairing(), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/tv/pair/status { pollSecret }: has someone typed my code in yet? */
export async function handlePairStatus(request: Request): Promise<Response> {
  try {
    limit(request);
    const body = (await request.json().catch(() => null)) as { pollSecret?: unknown } | null;
    const pollSecret = typeof body?.pollSecret === "string" ? body.pollSecret.slice(0, 200) : "";
    if (!pollSecret) throw new UserError("Missing pollSecret.", 400);
    return json(await collectPairing(pollSecret));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/tv/screen: what should this TV show?
 *
 * 401 means "this TV is not paired (any more)": the TV forgets its token and
 * shows a new pairing code. 304 means nothing changed since the ETag it sent,
 * which is the answer to almost every poll.
 */
export async function handleTvScreen(request: Request): Promise<Response> {
  try {
    limit(request);
    const device = await deviceForToken(bearer(request));
    if (!device) return json({ error: "This TV is not paired." }, 401);

    const { payload, etag } = await payloadForDevice(device);
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "no-store" } });
    }
    return json(payload, 200, { etag });
  } catch (error) {
    return errorResponse(error);
  }
}
