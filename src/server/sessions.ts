import type { Role } from "@/generated/prisma/enums";
import { bypass, db } from "./db";
import { inOrg } from "./org-context";
import { hashSecret, newSecret } from "./secrets";

/**
 * Signed-in browsers.
 *
 * The cookie carries a random token and the database keeps only its SHA-256,
 * so signing out (here or everywhere) is a row deletion, and a leaked database
 * cannot be turned back into cookies. A session belongs to one church: the
 * same person signed in to two churches holds two sessions.
 */
export const SESSION_COOKIE = "sd_session";

/**
 * Over https the cookie is `__Host-sd_session`: the browser then refuses to let
 * any other subdomain (a sibling church or Steward app on the hosted platform)
 * plant or overwrite it. Plain-http installs cannot use the prefix.
 */
export function sessionCookieName(secure: boolean): string {
  return secure ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE;
}
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** How stale `lastSeenAt` may get before a request refreshes it. */
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export interface Viewer {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

export async function createSession(
  userId: string,
  userAgent: string | null,
  now: Date = new Date(),
  opts: { viaSso?: boolean } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSecret("sds");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db().session.create({
    data: inOrg({
      userId,
      tokenHash: hashSecret(token),
      userAgent: userAgent?.slice(0, 300) ?? null,
      viaSso: opts.viaSso ?? false,
      expiresAt,
    }),
  });
  return { token, expiresAt };
}

/**
 * The person behind a session token, in the current church, or null.
 *
 * Null for an unknown, expired or foreign-church token, and for a person whose
 * membership here has since been removed: the session outlives nothing.
 */
export async function viewerForToken(
  token: string | undefined,
  now: Date = new Date(),
): Promise<Viewer | null> {
  if (!token) return null;

  const session = await db().session.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { id: true, userId: true, expiresAt: true, lastSeenAt: true },
  });
  if (!session || session.expiresAt <= now) return null;

  const [user, membership] = await Promise.all([
    db().user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, emailVerifiedAt: true },
    }),
    db().membership.findFirst({ where: { userId: session.userId }, select: { role: true } }),
  ]);
  if (!user || !membership) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db().session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    name: user.name,
    email: user.email,
    role: membership.role,
    emailVerified: !!user.emailVerifiedAt,
  };
}

/** Ends one session. Says whether it was a Steward ID one, so sign-out can end that too. */
export async function revokeSession(token: string): Promise<{ viaSso: boolean }> {
  const tokenHash = hashSecret(token);
  const session = await db().session.findUnique({ where: { tokenHash }, select: { viaSso: true } });
  await db().session.deleteMany({ where: { tokenHash } });
  return { viaSso: session?.viaSso ?? false };
}

/** Signs a person out of every browser at this church, optionally keeping one. */
/**
 * Signs a person out of every browser at every church. A password is one per
 * person, not per church, so changing it must end sessions everywhere it was
 * good. Deliberately unscoped, and only ever by the person's own id.
 */
export async function revokeSessionsEverywhere(
  userId: string,
  keepSessionId: string,
): Promise<number> {
  const { count } = await db().session.deleteMany(
    bypass({ where: { userId, id: { not: keepSessionId } } }),
  );
  return count;
}

export async function revokeAllSessions(userId: string, keepSessionId?: string): Promise<number> {
  const { count } = await db().session.deleteMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
  });
  return count;
}

/** The Set-Cookie value for a session, or for clearing one when `token` is null. */
export function sessionCookie(
  token: string | null,
  opts: { secure: boolean; expiresAt?: Date },
): string {
  const parts = [
    `${sessionCookieName(opts.secure)}=${token ?? ""}`,
    "Path=/",
    "HttpOnly",
    // Lax, not Strict: Strict drops the cookie on the navigation back from an
    // SSO provider and on links from email. Cross-site POSTs are refused by the
    // Origin check in src/server.ts regardless.
    "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  if (token && opts.expiresAt) parts.push(`Expires=${opts.expiresAt.toUTCString()}`);
  if (!token) parts.push("Max-Age=0");
  return parts.join("; ");
}
