import {
  getCookie,
  getRequest,
  getRequestHeader,
  getRequestIP,
  setResponseHeader,
} from "@tanstack/react-start/server";

import { UserError } from "./errors";
import { limits, type RateLimiter } from "./rate-limit";
import { SESSION_COOKIE, sessionCookie, viewerForToken, type Viewer } from "./sessions";

/**
 * The seam between the framework's request and this app's server modules.
 * Everything that reads a header or a cookie goes through here, so the modules
 * underneath stay testable with plain arguments.
 */

/** Behind Caddy (or any proxy) the socket address is the proxy's; trust its header only when told to. */
function trustProxy(): boolean {
  return process.env.TRUST_PROXY?.trim().toLowerCase() === "true";
}

export function clientIp(): string {
  return getRequestIP({ xForwardedFor: trustProxy() }) ?? "unknown";
}

export function userAgent(): string | null {
  return getRequestHeader("user-agent") ?? null;
}

/** Whether the browser reached us over https, directly or through the proxy. */
export function isSecureRequest(): boolean {
  if (trustProxy() && getRequestHeader("x-forwarded-proto") === "https") return true;
  return new URL(getRequest().url).protocol === "https:";
}

export function setSessionCookie(token: string, expiresAt: Date): void {
  setResponseHeader("set-cookie", sessionCookie(token, { secure: isSecureRequest(), expiresAt }));
}

export function clearSessionCookie(): void {
  setResponseHeader("set-cookie", sessionCookie(null, { secure: isSecureRequest() }));
}

export function sessionToken(): string | undefined {
  return getCookie(SESSION_COOKIE);
}

export async function currentViewer(): Promise<Viewer | null> {
  return viewerForToken(sessionToken());
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) throw new UserError("Your session has ended. Sign in again.", 401);
  return viewer;
}

export function requireOwner(viewer: Viewer): void {
  if (viewer.role !== "OWNER") {
    throw new UserError("Only the church's owner can do that.", 403);
  }
}

/** Throws a 429 with a human message when `key` is over its limit. */
export function enforceLimit(limiter: RateLimiter, key: string): void {
  const result = limiter.hit(key);
  if (!result.ok) {
    const minutes = Math.ceil(result.retryAfter / 60);
    throw new UserError(
      `Too many attempts. Wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
      429,
    );
  }
}

export { limits };
