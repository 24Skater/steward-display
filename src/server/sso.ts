/**
 * Single sign-on.
 *
 * One identity provider across the Steward applications, so somebody who uses
 * Congregation and VBS signs in once rather than twice.
 *
 * **Vendored, not imported.** The same file exists in the console, in
 * Congregation, in VBS and here, copied from VBS unchanged apart from this
 * paragraph and the EnvBag import. That is deliberate: this repository must
 * stay installable by a church that has never heard of the hosted platform,
 * and a shared package would make its install depend on a registry somebody
 * else controls. When the rule changes, change it in the console and port it
 * to every copy.
 *
 * **It is one more provider, never a replacement.** Email and password keeps
 * working. With no `AUTH0_ISSUER` the provider is not registered at all and
 * this file changes nothing.
 *
 * **Linking requires a verified email.** An identity provider will happily
 * issue an identity for an unverified address. Linking on one turns "I can
 * claim any email" into "I can take over the account that owns it" — so the
 * verification check is the whole of the security argument for letting an SSO
 * sign-in land on an account that already exists.
 */

import type { EnvBag } from "./env";

export interface SsoConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

/**
 * The SSO configuration, or null when this deployment has none.
 *
 * All three values or none. A half-configured provider fails at the redirect,
 * on somebody else's domain, with an error page this codebase cannot improve —
 * which is worse than not offering the button.
 */
export function ssoConfig(env: EnvBag = process.env): SsoConfig | null {
  const issuer = env.AUTH0_ISSUER?.trim();
  const clientId = env.AUTH0_CLIENT_ID?.trim();
  const clientSecret = env.AUTH0_CLIENT_SECRET?.trim();

  if (!issuer || !clientId || !clientSecret) return null;

  return { issuer: issuer.replace(/\/+$/, ""), clientId, clientSecret };
}

export function isSsoConfigured(env: EnvBag = process.env): boolean {
  return ssoConfig(env) !== null;
}

/** What the sign-in button says. Configurable, because the church reads it. */
export function ssoButtonLabel(env: EnvBag = process.env): string {
  return env.AUTH0_BUTTON_LABEL?.trim() || "Continue with Steward ID";
}

/**
 * Whether email-and-password sign-in is still offered.
 *
 * Defaults to **on**, and stays on unless somebody deliberately turns it off.
 * `passwordHash` is never dropped either. Turning this off is a decision taken
 * once SSO is proven for a given church, not a default that quietly strands
 * whoever had not signed in through the new provider yet.
 */
export function isLocalPasswordLoginAllowed(env: EnvBag = process.env): boolean {
  return env.ALLOW_LOCAL_PASSWORD_LOGIN?.trim().toLowerCase() !== "false";
}

/**
 * The claims this code cares about, from an OIDC ID token.
 *
 * `email_verified` arrives as either a boolean or the string "true" depending
 * on the connection — a database connection sends a boolean, some enterprise
 * connections send the string. Treating the string as falsy would lock out
 * exactly the customers most likely to be paying.
 */
export interface SsoProfileClaims {
  email?: string | null;
  email_verified?: boolean | string | null;
}

export function hasVerifiedEmail(profile: SsoProfileClaims | null | undefined): boolean {
  if (!profile?.email) return false;
  const verified = profile.email_verified;
  return verified === true || verified === "true";
}

export type SsoDecision = { ok: true } | { ok: false; reason: string };

/**
 * Whether an SSO sign-in may proceed.
 *
 * Separated from the Auth.js callback so the rule is testable without a
 * provider, a request or a database, and so a refusal is a value with a reason
 * rather than a log line.
 */
export function decideSsoSignIn(profile: SsoProfileClaims | null | undefined): SsoDecision {
  if (!profile?.email) {
    return { ok: false, reason: "The identity provider returned no email address." };
  }
  if (!hasVerifiedEmail(profile)) {
    return { ok: false, reason: "That address is not verified with the identity provider." };
  }
  return { ok: true };
}
