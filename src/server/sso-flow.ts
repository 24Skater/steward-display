import * as client from "openid-client";

import { safeNext } from "@/lib/safe-next";

import { db } from "./db";
import { isSecureRequest } from "./http";
import { requireOrg } from "./org-context";
import { rootDomain } from "./platform-domain";
import { publicUrl } from "./public-url";
import { limits } from "./rate-limit";
import { createSession, sessionCookie } from "./sessions";
import { decideSsoSignIn, ssoConfig, type SsoProfileClaims } from "./sso";

/**
 * Signing in with Steward ID: two routes, the way Congregation does it.
 *
 * `GET /api/auth/sso/start` sends the browser to the identity provider;
 * `GET /api/auth/sso/callback` takes it back and, if everything holds, mints
 * the same session a password sign-in does.
 *
 * What is deliberately absent:
 *
 * - **No account is created.** People join a church by invitation. An identity
 *   that matches nobody here gets the same answer as a wrong password.
 * - **No church is inferred from the token.** It comes from the hostname,
 *   exactly as for a password sign-in. The identity is portable; membership
 *   is not.
 * - **No address from the request.** The callback address is built from
 *   PUBLIC_URL or the hosted church's own address, so the provider only ever
 *   sends people back to where Display really lives.
 * - **No trust in an email alone, after the first time.** An account is bound
 *   to the Steward ID identity (issuer and subject) that first signs in to it;
 *   another identity claiming the same verified address is refused.
 */

const HANDOFF_SECONDS = 10 * 60;
/** After discovery fails, wait this long before asking the provider again. */
const DISCOVERY_BACKOFF_MS = 30_000;

interface Handoff {
  verifier: string;
  state: string;
  nonce: string;
  next: string;
}

/** Whether Steward ID sign-in is offered at this church: configured, and with an address to come back to. */
export function isSsoAvailable(): boolean {
  return ssoConfig() !== null && publicUrl(requireOrg().slug) !== null;
}

let discovered: Promise<client.Configuration> | null = null;
let discoveryFailedAt = 0;

/**
 * The provider's discovered metadata, fetched once and kept. After a failure
 * it waits before trying again, so an outage at the provider does not turn
 * every page load into a request to it.
 */
async function providerConfiguration(): Promise<client.Configuration> {
  const sso = ssoConfig();
  if (!sso) throw new Error("Single sign-on is not configured.");
  if (!discovered && Date.now() - discoveryFailedAt < DISCOVERY_BACKOFF_MS) {
    throw new Error("Identity provider discovery failed recently; backing off.");
  }
  const issuer = new URL(sso.issuer);
  // Plain http only for a provider on this same machine (a local test double),
  // which only whoever runs the server can configure, and never on the hosted
  // platform.
  const local =
    issuer.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(issuer.hostname) &&
    rootDomain() === null;
  discovered ??= client
    .discovery(issuer, sso.clientId, sso.clientSecret, undefined, {
      execute: local ? [client.allowInsecureRequests] : [],
    })
    .catch((error: unknown) => {
      discovered = null;
      discoveryFailedAt = Date.now();
      throw error;
    });
  return discovered;
}

function base(): string {
  return publicUrl(requireOrg().slug)!;
}

/**
 * The handoff lives in one cookie, `__Host-` prefixed over https: the browser
 * then refuses to let any sibling subdomain (another church, another Steward
 * app) plant or overwrite it, which is what would let someone finish a
 * sign-in they started in somebody else's browser.
 */
function handoffName(): string {
  return isSecureRequest() ? "__Host-sd_sso" : "sd_sso";
}

function handoffCookie(value: Handoff | null): string {
  // Lax, not Strict: a Strict cookie is not sent on the navigation back from
  // the provider, so the callback would find nothing and always fail.
  const parts = [
    `${handoffName()}=${value ? encodeURIComponent(JSON.stringify(value)) : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isSecureRequest()) parts.push("Secure");
  parts.push(value ? `Max-Age=${HANDOFF_SECONDS}` : "Max-Age=0");
  return parts.join("; ");
}

/** The handoff cookie, or null when it is missing or not one this code wrote. */
export function readHandoff(cookieHeader: string | null, name: string): Handoff | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) continue;
    try {
      const value = JSON.parse(decodeURIComponent(rest.join("="))) as Partial<Handoff>;
      const fields = [value.verifier, value.state, value.nonce, value.next];
      if (fields.every((f) => typeof f === "string" && f.length > 0 && f.length < 500)) {
        return value as Handoff;
      }
    } catch {
      // Malformed: treat as absent rather than failing the request.
    }
    return null;
  }
  return null;
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export type LinkResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "sso_unverified" | "sso_no_account" | "sso_mismatch" };

/**
 * Who a verified Steward ID identity is at the current church, if anyone.
 *
 * The first sign-in binds the account to the identity (`issuer|sub`); later
 * sign-ins must come from that same identity. Separated from the HTTP flow so
 * the rules are tested without a provider.
 */
export async function linkSsoIdentity(
  claims: (SsoProfileClaims & { sub?: string }) | undefined,
  issuer: string,
): Promise<LinkResult> {
  if (!decideSsoSignIn(claims).ok || !claims?.sub) return { ok: false, reason: "sso_unverified" };
  const subject = `${issuer}|${claims.sub}`;
  const email = String(claims.email).trim().toLowerCase();

  const user = await db().user.findUnique({
    where: { email },
    select: { id: true, ssoSubject: true },
  });
  if (!user) return { ok: false, reason: "sso_no_account" };
  if (user.ssoSubject && user.ssoSubject !== subject) return { ok: false, reason: "sso_mismatch" };
  const member = await db().membership.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  // No account, or one that does not belong here: the same answer either way.
  if (!member) return { ok: false, reason: "sso_no_account" };

  if (!user.ssoSubject) {
    // Bind on first use, unless that identity is already bound to someone else.
    const { count } = await db().user.updateMany({
      where: { id: user.id, ssoSubject: null },
      data: { ssoSubject: subject },
    });
    if (count !== 1) return { ok: false, reason: "sso_mismatch" };
  }
  return { ok: true, userId: user.id };
}

export async function handleSsoStart(request: Request): Promise<Response> {
  if (!ssoConfig() || !isSsoAvailable()) {
    return new Response("Single sign-on is not set up here.", { status: 404 });
  }
  // Begin on the address the provider will send people back to; otherwise the
  // handoff cookie would be set on one host and looked for on another.
  const requestUrl = new URL(request.url);
  const next = safeNext(requestUrl.searchParams.get("next"));
  if (requestUrl.origin !== base()) {
    return redirect(`${base()}/api/auth/sso/start?next=${encodeURIComponent(next)}`);
  }

  try {
    const config = await providerConfiguration();
    const handoff: Handoff = {
      verifier: client.randomPKCECodeVerifier(),
      state: client.randomState(),
      nonce: client.randomNonce(),
      next,
    };
    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: `${base()}/api/auth/sso/callback`,
      scope: "openid email profile",
      code_challenge: await client.calculatePKCECodeChallenge(handoff.verifier),
      code_challenge_method: "S256",
      state: handoff.state,
      nonce: handoff.nonce,
    });
    return redirect(authorizationUrl.href, [handoffCookie(handoff)]);
  } catch (error) {
    console.error("[sso] start failed:", error);
    return redirect("/login?error=sso_unavailable");
  }
}

export async function handleSsoCallback(
  request: Request,
  ip: string,
  userAgent: string | null,
): Promise<Response> {
  if (!ssoConfig() || !isSsoAvailable()) {
    return new Response("Single sign-on is not set up here.", { status: 404 });
  }
  const clear = handoffCookie(null);
  const fail = (reason: string) => redirect(`/login?error=${reason}`, [clear]);
  if (!limits.ssoCallback.hit(ip).ok) return fail("sso_busy");

  // A bookmarked callback, or a handshake that outlived its cookie. Never a
  // reason to skip the checks below.
  const handoff = readHandoff(request.headers.get("cookie"), handoffName());
  if (!handoff) return fail("sso_expired");

  try {
    const config = await providerConfiguration();
    // The address the provider redirected to, rebuilt from our own base and
    // the query it added, never from the Host the request claims.
    const current = new URL(`${base()}/api/auth/sso/callback${new URL(request.url).search}`);
    const tokens = await client.authorizationCodeGrant(config, current, {
      pkceCodeVerifier: handoff.verifier,
      expectedState: handoff.state,
      expectedNonce: handoff.nonce,
    });
    const claims = tokens.claims() as (SsoProfileClaims & { sub?: string }) | undefined;
    const link = await linkSsoIdentity(claims, config.serverMetadata().issuer);
    if (!link.ok) {
      console.warn(`[sso] refused at ${requireOrg().slug}: ${link.reason} (ip ${ip})`);
      return fail(link.reason);
    }

    const session = await createSession(link.userId, userAgent, new Date(), { viaSso: true });
    console.info(`[sso] signed in user ${link.userId} at ${requireOrg().slug} (ip ${ip})`);
    // Same Secure decision, and so the same cookie name, as a password sign-in.
    return redirect(handoff.next, [
      clear,
      sessionCookie(session.token, { secure: isSecureRequest(), expiresAt: session.expiresAt }),
    ]);
  } catch (error) {
    // A failed state or nonce check lands here, as does a refused code.
    console.error("[sso] callback failed:", error);
    return fail("sso_failed");
  }
}

/**
 * Where to send someone who signed in with Steward ID after they sign out of
 * Display, so the provider forgets them too. On a shared church computer the
 * next person would otherwise be signed straight back in as them.
 */
export async function ssoSignOutUrl(): Promise<string | null> {
  if (!isSsoAvailable()) return null;
  try {
    const config = await providerConfiguration();
    if (!config.serverMetadata().end_session_endpoint) return null;
    return client.buildEndSessionUrl(config, {
      client_id: ssoConfig()!.clientId,
      post_logout_redirect_uri: `${base()}/login`,
    }).href;
  } catch {
    return null;
  }
}
