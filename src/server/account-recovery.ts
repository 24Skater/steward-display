import { passwordSchema } from "./accounts";
import { bypass, db } from "./db";
import { passwordResetEmail, verificationEmail } from "./emails";
import { UserError } from "./errors";
import { isEmailConfigured, sendEmail } from "./mailer";
import { requireOrg } from "./org-context";
import { hashPassword, verifyPassword } from "./password";
import { appLink } from "./public-url";
import { emailSchema } from "./schemas";
import { hashSecret } from "./secrets";
import { lockOwners } from "./team";
import { consumeUserToken, isUserTokenValid, issueUserToken } from "./user-tokens";

/**
 * Forgotten passwords, email verification and deleting an account.
 */

/** Whether this installation can send people links. Both email and a trustworthy address are needed. */
export function canEmailLinks(): boolean {
  return isEmailConfigured() && appLink(requireOrg().slug, "/") !== null;
}

/** Whether `email` belongs here: a member, or someone with an open invitation. */
async function belongsHere(email: string, userId: string): Promise<boolean> {
  if (await db().membership.findFirst({ where: { userId }, select: { id: true } })) return true;
  const invited = await db().invitation.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return !!invited;
}

/**
 * Emails a reset link if `email` has an account and belongs at this church.
 *
 * Says nothing either way, and takes the same time either way: the lookup, the
 * new link and the email happen after the answer has gone, so neither the
 * reply nor how long it took tells anyone whether the address has an account.
 *
 * An open invitation counts as belonging. If someone else set up an account
 * under your address (an owner who opened your invitation link themselves),
 * resetting by email is how you take it back.
 */
export async function requestPasswordReset(input: unknown): Promise<{ settled: Promise<void> }> {
  const email = emailSchema.parse((input as { email?: unknown } | null)?.email);
  const org = requireOrg();
  if (!canEmailLinks()) {
    throw new UserError(
      "This server can't send email yet. Ask whoever runs Display for your church to reset your password.",
      503,
    );
  }

  // `settled` is for tests; the request returns without waiting for it.
  const settled = (async () => {
    const user = await db().user.findUnique({ where: { email }, select: { id: true } });
    if (!user || !(await belongsHere(email, user.id))) return;
    const token = await issueUserToken(user.id, "RESET_PASSWORD");
    const link = appLink(org.slug, `/reset-password/${token}`)!;
    await sendEmail(passwordResetEmail({ to: email, churchName: org.name, link }));
  })().catch((error: unknown) => console.error("[reset] Could not issue a reset link:", error));
  return { settled };
}

/** Whether a reset link can still be used, so the page can say so before anyone types. */
export function isResetLinkValid(token: unknown): Promise<boolean> {
  return typeof token === "string" && token.length <= 200
    ? isUserTokenValid(token, "RESET_PASSWORD")
    : Promise.resolve(false);
}

/**
 * Sets a new password from a reset link, marks the address verified (the link
 * proves they read its mail) and signs the person out everywhere, which is the
 * point of resetting a password somebody else may know.
 */
export async function resetPassword(input: unknown): Promise<void> {
  const { token, newPassword } = (input ?? {}) as { token?: unknown; newPassword?: unknown };
  const password = passwordSchema.parse(newPassword);
  const userId = typeof token === "string" ? await consumeUserToken(token, "RESET_PASSWORD") : null;
  if (!userId) {
    throw new UserError("This reset link has expired or was already used. Ask for a new one.", 400);
  }
  const passwordHash = await hashPassword(password);
  const now = new Date();
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  await db().user.update({
    where: { id: userId },
    data: { passwordHash, emailVerifiedAt: user?.emailVerifiedAt ?? now },
  });
  // Every church, not only this one: the password is the person's, not the church's.
  await db().session.deleteMany(bypass({ where: { userId } }));
}

/** Emails a verification link to a person who has not verified yet. Returns whether one was sent. */
export async function sendVerification(userId: string): Promise<boolean> {
  const org = requireOrg();
  if (!canEmailLinks()) return false;
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return false;
  const token = await issueUserToken(userId, "VERIFY_EMAIL");
  const link = appLink(org.slug, `/verify-email/${token}`)!;
  return (await sendEmail(verificationEmail({ to: user.email, churchName: org.name, link }))).sent;
}

/**
 * Confirms an address from its link. A link already used still succeeds when
 * the address is confirmed: some mail scanners open links in a real browser
 * before the person does, and they should not be told it failed.
 */
export async function verifyEmail(token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length > 200) {
    throw new UserError("This confirmation link has expired or was already used.", 400);
  }
  const userId = await consumeUserToken(token, "VERIFY_EMAIL");
  if (userId) {
    await db().user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return;
  }
  const used = await db().userToken.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { purpose: true, user: { select: { emailVerifiedAt: true } } },
  });
  if (used?.purpose === "VERIFY_EMAIL" && used.user.emailVerifiedAt) return;
  throw new UserError("This confirmation link has expired or was already used.", 400);
}

/**
 * Deletes a person's account, everywhere.
 *
 * Refused while they are the only owner of any church: that church would be
 * left with nobody able to manage it, and on a self-hosted install nobody able
 * to sign in at all. They make someone else owner first. The check and the
 * deletion hold each church's owner lock, so two owners deleting themselves at
 * once cannot both succeed.
 */
export async function deleteAccount(userId: string, password: unknown): Promise<void> {
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return;
  if (
    !user.passwordHash ||
    typeof password !== "string" ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    throw new UserError("That password isn't right.", 400);
  }

  await db().$transaction(async (tx) => {
    // Across every church this person belongs to: deletion is not per church.
    const owned = await tx.membership.findMany(
      bypass({ where: { userId, role: "OWNER" as const }, select: { orgId: true } }),
    );
    // Always in the same order, so two deletions cannot wait on each other.
    for (const orgId of owned.map((m) => m.orgId).sort()) {
      await lockOwners(tx, orgId);
      const owners = await tx.membership.count(
        bypass({ where: { orgId, role: "OWNER" as const } }),
      );
      if (owners <= 1) {
        const org = await tx.org.findUnique(
          bypass({ where: { id: orgId }, select: { name: true } }),
        );
        throw new UserError(
          `You're the only owner of ${org?.name ?? "a church"}. Make someone else an owner on the Team page first.`,
          409,
        );
      }
    }
    // Their unaccepted invitations go with them, at every church.
    await tx.invitation.deleteMany(bypass({ where: { invitedById: userId, acceptedAt: null } }));
    // Memberships, sessions and links cascade.
    await tx.user.delete({ where: { id: userId } });
  });
}
