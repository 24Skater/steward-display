import { bypass, db } from "./db";
import { passwordResetEmail, verificationEmail } from "./emails";
import { UserError } from "./errors";
import { isEmailConfigured, sendEmail } from "./mailer";
import { requireOrg } from "./org-context";
import { hashPassword, verifyPassword } from "./password";
import { appLink } from "./public-url";
import { emailSchema } from "./schemas";
import { passwordSchema } from "./accounts";
import { consumeUserToken, issueUserToken } from "./user-tokens";

/**
 * Forgotten passwords, email verification and deleting an account.
 */

/** Whether this installation can send people links. Both email and a trustworthy address are needed. */
export function canEmailLinks(): boolean {
  return isEmailConfigured() && appLink(requireOrg().slug, "/") !== null;
}

/**
 * Emails a reset link if `email` belongs to someone at this church.
 *
 * Says nothing either way: whether an address has an account here is not
 * something to tell whoever types it in.
 */
export async function requestPasswordReset(input: unknown): Promise<void> {
  const email = emailSchema.parse((input as { email?: unknown } | null)?.email);
  const org = requireOrg();
  if (!canEmailLinks()) {
    throw new UserError(
      "This server can't send email yet. Ask whoever runs Display for your church to reset your password.",
      503,
    );
  }

  const user = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  const member = await db().membership.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!member) return;

  const token = await issueUserToken(user.id, "RESET_PASSWORD");
  const link = appLink(org.slug, `/reset-password/${token}`)!;
  await sendEmail(passwordResetEmail({ to: email, churchName: org.name, link }));
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

export async function verifyEmail(token: unknown): Promise<void> {
  const userId = typeof token === "string" ? await consumeUserToken(token, "VERIFY_EMAIL") : null;
  if (!userId) throw new UserError("This confirmation link has expired or was already used.", 400);
  await db().user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

/**
 * Deletes a person's account, everywhere.
 *
 * Refused while they are the only owner of any church: that church would be
 * left with nobody able to manage it, and on a self-hosted install nobody able
 * to sign in at all. They make someone else owner first.
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

  // Across every church this person belongs to: deletion is not per church.
  const owned = await db().membership.findMany(
    bypass({ where: { userId, role: "OWNER" as const }, select: { orgId: true } }),
  );
  for (const { orgId } of owned) {
    const owners = await db().membership.count(
      bypass({ where: { orgId, role: "OWNER" as const } }),
    );
    if (owners <= 1) {
      const org = await db().org.findUnique(
        bypass({ where: { id: orgId }, select: { name: true } }),
      );
      throw new UserError(
        `You're the only owner of ${org?.name ?? "a church"}. Make someone else an owner on the Team page first.`,
        409,
      );
    }
  }

  // Memberships, sessions and links cascade; invitations they sent keep working.
  await db().user.delete({ where: { id: userId } });
}
