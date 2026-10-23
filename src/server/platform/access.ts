import type { EnvBag } from "../env";
import { checkEntitlement } from "./entitlements";

/**
 * Whether a church may use Display at all, decided once per request.
 *
 * Only two answers stop a request here: REVOKED, and a church that never
 * bought Display. READ_ONLY passes, because reading is what it is for; its
 * writes are refused one query at a time in `db.ts`. Self-hosted installs,
 * and a console outage, allow everything (see `entitlements.ts`).
 *
 * A TV gets 403, never 401. The player forgets its pairing on a 401
 * (`useTvPlayer.ts`), and a church that renews should find its TVs still
 * paired; on any other error the TV keeps showing the last screen it had.
 */

/** How often a TV showing the "not active" page checks whether the church renewed. */
const TV_RETRY_SECONDS = 300;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** A console URL safe to link to, or null. */
function consoleLink(env: EnvBag): string | null {
  const raw = env.PLATFORM_CONSOLE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The page a person, or a TV that reloaded, sees instead of the app.
 *
 * `retrySeconds` makes it check again by itself: a TV that rebooted while the
 * church was revoked has no player loaded to poll with, and must come back on
 * its own once the church renews rather than wait for someone to power-cycle it.
 */
export function renderSubscriptionPage(
  churchName: string,
  env: EnvBag = process.env,
  retrySeconds: number | null = null,
): string {
  const link = consoleLink(env);
  const action = link
    ? `<a class="primary" href="${escapeHtml(link)}">Open the Steward console</a>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Steward Display is not active</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />${
      retrySeconds
        ? `
    <meta http-equiv="refresh" content="${retrySeconds}" />`
        : ""
    }
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #faf7f2; color: #0d1b2e; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 30rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #57647a; margin: 0 0 1.5rem; }
      a { display: inline-block; padding: 0.5rem 1rem; border-radius: 0.375rem; text-decoration: none; }
      .primary { background: #1b2a41; color: #fff; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Steward Display is not active for ${escapeHtml(churchName)}</h1>
      <p>The subscription has ended or does not include Display. Whoever manages billing for your church can turn it back on in the Steward console; your screens and TVs are kept.</p>
      ${action}
    </div>
  </body>
</html>`;
}

/** The response that refuses this request, or null when it may proceed. */
export async function accessRefusal(
  request: Request,
  org: { orgId: string; name: string },
  env: EnvBag = process.env,
): Promise<Response | null> {
  const decision = await checkEntitlement(org.orgId, false, env);
  if (decision.allow) return null;

  const { pathname } = new URL(request.url);
  const headers = { "cache-control": "no-store" };
  if (pathname.startsWith("/api/") || pathname.startsWith("/_serverFn/")) {
    return new Response(JSON.stringify({ error: "subscription_inactive" }), {
      status: 403,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  }
  const isTv = pathname === "/tv" || pathname.startsWith("/tv/");
  return new Response(renderSubscriptionPage(org.name, env, isTv ? TV_RETRY_SECONDS : null), {
    status: 403,
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  });
}
