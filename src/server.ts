import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { isSameOriginWrite, isSetupPath } from "./server/gate";
import { runInOrg } from "./server/org-context";
import { resolveOrg } from "./server/org-resolver";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Sent on every response. The admin app and TV views are private, so nothing here may be
// indexed - this covers non-HTML responses and error pages the robots meta tag cannot.
// HSTS and compression are the edge proxy's job (Caddy), not the app's.
const BASELINE_HEADERS: Record<string, string> = {
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "SAMEORIGIN",
};

function withBaselineHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASELINE_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function plainResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Every request runs inside the church its hostname names (see
 * `server/org-resolver.ts`), so the database guard always knows whose data a
 * query may touch. Before a church exists, only setup runs.
 */
async function handle(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  if (!isSameOriginWrite(request)) {
    return plainResponse(403, "This request did not come from this site.");
  }

  const handler = await getServerEntry();
  const run = async () => normalizeCatastrophicSsrResponse(await handler.fetch(request, env, ctx));

  const resolution = await resolveOrg(request.headers.get("host"));
  switch (resolution.kind) {
    case "org":
      return runInOrg(resolution.org, run);
    case "setup": {
      const { pathname } = new URL(request.url);
      if (isSetupPath(pathname)) return run();
      if (pathname.startsWith("/api/")) return plainResponse(503, "Not set up yet.");
      return new Response(null, { status: 303, headers: { location: "/setup" } });
    }
    case "unknown-host":
      return plainResponse(404, "There is no Steward Display at this address.");
    case "ambiguous":
      console.error("[Tenancy] Self-hosted install has more than one church; refusing to guess.");
      return plainResponse(500, "This installation is misconfigured. Check the server log.");
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      return withBaselineHeaders(await handle(request, env, ctx));
    } catch (error) {
      console.error(error);
      return withBaselineHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
