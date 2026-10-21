import { deviceForToken, payloadForDevice } from "./devices";
import { UserError, toUserError } from "./errors";
import { collectPairing, startPairing } from "./pairing";
import { limits, type RateLimiter } from "./rate-limit";
import { hashSecret } from "./secrets";

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

/** Throws a 429 when `key` is over `limiter`'s limit. */
function limit(limiter: RateLimiter, key: string): void {
  if (!limiter.hit(key).ok)
    throw new UserError("Too many requests. The TV will retry shortly.", 429);
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

/*
 * Rate limits are keyed by what identifies the caller best: the address for a
 * TV asking for a code, the poll secret for a TV waiting on one, the device
 * token for a paired TV. One noisy client therefore never starves the rest of
 * the lobby, and `ip` comes from the socket (or the trusted proxy hop), never
 * from a header the client wrote. See client-ip.ts.
 */

/** POST /api/tv/pair: a TV asks for a code to show. */
export async function handlePairStart(request: Request, ip: string): Promise<Response> {
  try {
    limit(limits.pairStart, ip);
    return json(await startPairing(), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/tv/pair/status { pollSecret }: has someone typed my code in yet? */
export async function handlePairStatus(request: Request, ip: string): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as { pollSecret?: unknown } | null;
    const pollSecret = typeof body?.pollSecret === "string" ? body.pollSecret.slice(0, 200) : "";
    if (!pollSecret) throw new UserError("Missing pollSecret.", 400);
    limit(limits.tvPairPoll, hashSecret(pollSecret));
    const result = await collectPairing(pollSecret);
    // Only dead or made-up secrets count against the address: every TV at a
    // church shares one public address, and waiting ones poll every 3 s.
    if (result.status === "expired") limit(limits.tvUnauthenticated, ip);
    return json(result);
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
export async function handleTvScreen(request: Request, ip: string): Promise<Response> {
  try {
    const token = bearer(request);
    if (!token) return json({ error: "This TV is not paired." }, 401);
    limit(limits.tvScreenPoll, hashSecret(token));
    const device = await deviceForToken(token);
    if (!device) {
      // Only failures count against the address: a paired TV never hits this.
      limit(limits.tvUnauthenticated, ip);
      return json({ error: "This TV is not paired." }, 401);
    }

    const { payload, etag } = await payloadForDevice(device);
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "no-store" } });
    }
    return json(payload, 200, { etag });
  } catch (error) {
    return errorResponse(error);
  }
}
