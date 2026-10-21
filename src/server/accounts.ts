import { bypass, db } from "./db";
import { UserError } from "./errors";
import { clearOrgCache, isHosted } from "./org-resolver";
import { requireOrg, runInOrg, type OrgContext } from "./org-context";
import {
  decoyHash,
  hashPassword,
  verifyPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./password";
import { churchNameSchema, emailSchema, personNameSchema } from "./schemas";
import { createSession, revokeAllSessions } from "./sessions";
import { z } from "zod";

/**
 * Accounts: first-run setup, sign-in and password changes.
 *
 * Email and password is this app's own sign-in, and stays available even once
 * single sign-on arrives: a church running Display on its own server never
 * needs an identity provider, and an outage at one must never lock a church
 * out of its own TVs.
 */

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const setupInputSchema = z.object({
  churchName: churchNameSchema,
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
});

export type SignedIn = { token: string; expiresAt: Date };

/** The one message for every failed sign-in: which part was wrong is nobody's business. */
const SIGN_IN_FAILED = "That email and password don't match an account at this church.";

/** A slug for a self-hosted church. Never shown in a URL on a self-hosted install. */
function slugFor(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "church";
}

/**
 * Creates the installation's church and its first owner, and signs them in.
 *
 * Only on a self-hosted install, and only once: the advisory lock makes two
 * people racing through the setup page produce one church, not two. On the
 * hosted platform, churches are provisioned by the console instead.
 */
export async function setUpInstallation(
  input: unknown,
  userAgent: string | null,
): Promise<SignedIn> {
  if (isHosted()) throw new UserError("Setup is not available here.", 404);
  const { churchName, name, email, password } = setupInputSchema.parse(input);
  const passwordHash = await hashPassword(password);

  const org = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('steward-display:setup'))`;
    // Setup is about the installation, before any church exists.
    if ((await tx.org.count(bypass({}))) > 0) {
      throw new UserError("This installation is already set up. Sign in instead.", 409);
    }
    const created = await tx.org.create(
      bypass({ data: { name: churchName, slug: slugFor(churchName) } }),
    );
    // create, never upsert: setup must not be a way to reset somebody's password.
    const user = await tx.user.create(bypass({ data: { email, name, passwordHash } }));
    await tx.membership.create(
      bypass({ data: { orgId: created.id, userId: user.id, role: "OWNER" as const } }),
    );
    return {
      context: { orgId: created.id, slug: created.slug, name: created.name },
      userId: user.id,
    };
  });

  clearOrgCache();
  return runInOrg(org.context satisfies OrgContext, () => createSession(org.userId, userAgent));
}

/** Signs a person in to the current church. */
export async function signIn(input: unknown, userAgent: string | null): Promise<SignedIn> {
  const { email, password } = signInInputSchema.parse(input);
  requireOrg();

  // The user row is global: one person, one password, however many churches.
  const user = await db().user.findUnique(
    bypass({ where: { email }, select: { id: true, passwordHash: true } }),
  );
  const valid = await verifyPassword(password, user?.passwordHash ?? (await decoyHash()));
  if (!user?.passwordHash || !valid) throw new UserError(SIGN_IN_FAILED, 401);

  const membership = await db().membership.findFirst({ where: { userId: user.id } });
  if (!membership) throw new UserError(SIGN_IN_FAILED, 401);

  return createSession(user.id, userAgent);
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
});

/**
 * Changes a password and signs the person out everywhere else, which is the
 * point of changing a password you think somebody else knows.
 */
export async function changePassword(
  userId: string,
  keepSessionId: string,
  input: unknown,
): Promise<{ signedOut: number }> {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const user = await db().user.findUnique(
    bypass({ where: { id: userId }, select: { passwordHash: true } }),
  );
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new UserError("Your current password isn't right.", 400);
  }
  await db().user.update(
    bypass({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } }),
  );
  return { signedOut: await revokeAllSessions(userId, keepSessionId) };
}
