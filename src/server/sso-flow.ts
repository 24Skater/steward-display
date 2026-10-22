import * as client from "openid-client";

import { safeNext } from "@/lib/safe-next";

import { db } from "./db";
import { isSecureRequest } from "./http";
import { requireOrg } from "./org-context";
import { publicUrl } from "./public-url";
import { limits } from "./rate-limit";
import { createSession, sessionCookie } from "./sessions";
import { decideSsoSignIn, ssoConfig, type SsoProfileClaims } from "./sso";

/**
 * Signing in with Steward ID: two routes, the way Congregation does it.
 *
 * `GET /api/auth/sso/start` sends the browser to the identity provider;
 * `GET /api/auth/sso/callback` takes it back and, if everything holds, mints
 * the same session a password sign-in does. Nothing downstream knows which
 * route produced it.
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
 */

const HANDOFF_SECONDS = 10 * 60;
const COOKIE = {
  verifier: "sd_sso_verifier",
  state: "sd_sso_state",
  nonce: "sd_sso_nonce",
  next: "sd_sso_next",
} as const;

/** Whether Steward ID sign-in is offered at this church: configured, and with an address to come back to. */
export function isSsoAvailable(): boolean {
  return ssoConfig() !== null && publicUrl(requireOrg().slug) !== null;
}

/**
 * The provider's discovered metadata, fetched once. Discovery is a network
 * call to somebody else's server; doing it per sign-in would put their
 * availability in front of ours for no benefit.
 */
let discovered: Promise<client.Configuration> | null = null;

function providerConfiguration(): Promise<client.Configuration> | null {
  const sso = ssoConfig();
  if (!sso) return null;
  const issuer = new URL(sso.issuer);
  // Plain http only for a provider on this machine (a local test double);
  // anything reachable over a network must be https.
  const local = issuer.protocol === "http:" && ["localhost", "127.0.0.1"].includes(issuer.hostname);
  discovered ??= client
    .discovery(issuer, sso.clientId, sso.clientSecret, undefined, {
      execute: local ? [client.allowInsecureRequests] : [],
    })
    .catch((error: unknown) => {
      discovered = null; // retry next time rather than replaying the failure forever
      throw error;
    });
  return discovered;
}

function base(): string {
  return publicUrl(requireOrg().slug)!;
}

function handoffCookie(name: string, value: string | null): string {
  // Lax, not Strict: a Strict cookie is not sent on the navigation back from
  // the provider, so the callback would find no verifier and always fail.
  const parts = [
    `${name}=${value ? encodeURIComponent(value) : ""}`,
    "Path=/api/auth/sso",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isSecureRequest()) parts.push("Secure");
  parts.push(value ? `Max-Age=${HANDOFF_SECONDS}` : "Max-Age=0");
  return parts.join("; ");
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

const failed = (reason: string) => redirect(`/login?error=${reason}`);

export async function handleSsoStart(request: Request, ip: string): Promise<Response> {
  const configuration = providerConfiguration();
  if (!configuration || !isSsoAvailable()) {
    return new Response("Single sign-on is not set up here.", { status: 404 });
  }
  if (!limits.signInPerIp.hit(ip).ok) return failed("sso_busy");

  try {
    const config = await configuration;
    const verifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const next = safeNext(new URL(request.url).searchParams.get("next"));
    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: `${base()}/api/auth/sso/callback`,
      scope: "openid email profile",
      code_challenge: await client.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    });
    return redirect(authorizationUrl.href, [
      handoffCookie(COOKIE.verifier, verifier),
      handoffCookie(COOKIE.state, state),
      handoffCookie(COOKIE.nonce, nonce),
      handoffCookie(COOKIE.next, next),
    ]);
  } catch (error) {
    console.error("[sso] start failed:", error);
    return failed("sso_unavailable");
  }
}

export async function handleSsoCallback(
  request: Request,
  ip: string,
  userAgent: string | null,
): Promise<Response> {
  const configuration = providerConfiguration();
  if (!configuration || !isSsoAvailable()) {
    return new Response("Single sign-on is not set up here.", { status: 404 });
  }
  if (!limits.signInPerIp.hit(ip).ok) return failed("sso_busy");

  const verifier = readCookie(request, COOKIE.verifier);
  const state = readCookie(request, COOKIE.state);
  const nonce = readCookie(request, COOKIE.nonce);
  const next = safeNext(readCookie(request, COOKIE.next));
  const clear = Object.values(COOKIE).map((name) => handoffCookie(name, null));
  const fail = (reason: string) => redirect(`/login?error=${reason}`, clear);

  // A bookmarked callback, or a handshake that outlived its cookies. Never a
  // reason to skip the checks below.
  if (!verifier || !state || !nonce) return fail("sso_expired");

  try {
    const config = await configuration;
    // The address the provider redirected to, rebuilt from our own base and
    // the query it added, never from the Host the request claims.
    const current = new URL(`${base()}/api/auth/sso/callback${new URL(request.url).search}`);
    const tokens = await client.authorizationCodeGrant(config, current, {
      pkceCodeVerifier: verifier,
      expectedState: state,
      expectedNonce: nonce,
    });
    const claims = tokens.claims() as SsoProfileClaims | undefined;
    const decision = decideSsoSignIn(claims);
    if (!decision.ok) {
      console.warn(`[sso] refused: ${decision.reason}`);
      return fail("sso_unverified");
    }

    const email = String(claims?.email).trim().toLowerCase();
    const user = await db().user.findUnique({ where: { email }, select: { id: true } });
    const member = user
      ? await db().membership.findFirst({ where: { userId: user.id }, select: { id: true } })
      : null;
    // No account, or an account that does not belong here: the same answer.
    if (!user || !member) return fail("sso_no_account");

    const session = await createSession(user.id, userAgent);
    // Same Secure decision, and so the same cookie name, as a password sign-in.
    return redirect(next, [
      ...clear,
      sessionCookie(session.token, { secure: isSecureRequest(), expiresAt: session.expiresAt }),
    ]);
  } catch (error) {
    // A failed state or nonce check lands here, as does a refused code.
    console.error("[sso] callback failed:", error);
    return fail("sso_failed");
  }
}
