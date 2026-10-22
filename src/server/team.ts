import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { db } from "./db";
import { invitationEmail } from "./emails";
import { UserError } from "./errors";
import { sendEmail } from "./mailer";
import { inOrg, requireOrg } from "./org-context";
import { hashPassword, verifyPassword } from "./password";
import { publicUrl } from "./public-url";
import { emailSchema, personNameSchema } from "./schemas";
import { passwordSchema } from "./accounts";
import { hashSecret, newSecret } from "./secrets";
import { createSession, type Viewer } from "./sessions";

/**
 * The people who run a church's screens, and how more of them join.
 *
 * An owner invites by email with a role. The invitation is a single-use link
 * that lasts a week. Whoever opens it either creates an account or, if the
 * address already has one (they help at another church), proves it with their
 * password. Either way they join this church only.
 */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const roleSchema = z.enum(["OWNER", "EDITOR"]);

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

export async function listTeam(now: Date = new Date()): Promise<{
  members: TeamMember[];
  invitations: PendingInvitation[];
}> {
  const memberships = await db().membership.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, role: true },
  });
  // Users are global rows, read by the ids this church's memberships name.
  const users = await db().user.findMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const invitations = await db().invitation.findMany({
    where: { acceptedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true },
  });

  return {
    members: memberships.flatMap((m) => {
      const user = byId.get(m.userId);
      return user
        ? [
            {
              membershipId: m.id,
              userId: m.userId,
              name: user.name,
              email: user.email,
              role: m.role,
              emailVerified: !!user.emailVerifiedAt,
            },
          ]
        : [];
    }),
    invitations: invitations.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })),
  };
}

/**
 * Invites `email` with `role`.
 *
 * When the invitation is emailed, the link goes only to the invited address
 * and never back to the owner. An owner holding a link for an address they do
 * not control could otherwise open it and create that person's account before
 * they do. When it cannot be emailed the owner has to pass it on, and the real
 * person can still take the account back: an open invitation is reason enough
 * to send them a password reset (see account-recovery.ts).
 *
 * `requestOrigin` is the owner's own address bar, used only on a self-hosted
 * install with no PUBLIC_URL, and such a link is emailed only if it is https.
 */
export async function inviteMember(
  inviter: Viewer,
  input: unknown,
  requestOrigin: string,
  now: Date = new Date(),
): Promise<{ link: string | null; emailed: boolean }> {
  const { email, role } = z.object({ email: emailSchema, role: roleSchema }).parse(input);
  const org = requireOrg();

  const existing = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (existing && (await db().membership.findFirst({ where: { userId: existing.id } }))) {
    throw new UserError(`${email} is already on the team.`, 409);
  }

  // One live invitation per address: a new one replaces the old link.
  await db().invitation.deleteMany({ where: { email, acceptedAt: null } });
  const token = newSecret("sdi");
  await db().invitation.create({
    data: inOrg({
      email,
      role,
      tokenHash: hashSecret(token),
      invitedById: inviter.userId,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
    }),
  });

  const base = publicUrl(org.slug);
  const link = `${base ?? requestOrigin}/invite/${token}`;
  // A guessed, plain-http address (a LAN IP, say) is not one to put in an email.
  const emailable = base !== null || requestOrigin.startsWith("https://");
  const result = emailable
    ? await sendEmail(
        invitationEmail({ to: email, churchName: org.name, inviterName: inviter.name, role, link }),
      )
    : { sent: false as const };
  return result.sent ? { link: null, emailed: true } : { link, emailed: false };
}

/** Cancels an invitation. False when it was accepted (or cancelled) in the meantime. */
export async function revokeInvitation(id: string): Promise<boolean> {
  const { count } = await db().invitation.deleteMany({ where: { id, acceptedAt: null } });
  return count === 1;
}

/** What the invitation page shows before anyone types anything. */
export async function describeInvitation(
  token: string,
  now: Date = new Date(),
): Promise<{ email: string; role: Role; churchName: string; hasAccount: boolean } | null> {
  const invitation = await db().invitation.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { email: true, role: true, acceptedAt: true, expiresAt: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= now) return null;
  const user = await db().user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  return {
    email: invitation.email,
    role: invitation.role,
    churchName: requireOrg().name,
    hasAccount: !!user,
  };
}

const acceptSchema = z.object({
  token: z.string().min(1).max(200),
  /** New account: their name. */
  name: personNameSchema.optional(),
  /** New account: a new password; existing account: their current one. */
  password: z.string().min(1).max(256),
});

/**
 * Accepts an invitation and signs the person in.
 *
 * The address on the invitation is the identity: someone with an account
 * proves it with that account's password, someone without one creates it.
 */
export async function acceptInvitation(
  input: unknown,
  userAgent: string | null,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const { token, name, password } = acceptSchema.parse(input);
  const invitation = await db().invitation.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { id: true, email: true, role: true, acceptedAt: true, expiresAt: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= now) {
    throw new UserError("This invitation has expired or was already used. Ask for a new one.", 410);
  }

  const existing = await db().user.findUnique({
    where: { email: invitation.email },
    select: { id: true, passwordHash: true },
  });
  let newAccount: { name: string; passwordHash: string } | null = null;
  if (existing) {
    if (!existing.passwordHash || !(await verifyPassword(password, existing.passwordHash))) {
      throw new UserError(
        `That isn't the password for ${invitation.email}. Forgot it? Use "Forgot your password?" on the sign-in page.`,
        401,
      );
    }
  } else {
    if (!name) throw new UserError("Enter your name.", 400);
    newAccount = { name, passwordHash: await hashPassword(passwordSchema.parse(password)) };
  }

  // All or nothing: marking the invitation used, creating the account and
  // joining. Two tabs accepting at once leave one member and no stray account.
  let userId: string;
  try {
    userId = await db().$transaction(async (tx) => {
      const { count } = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: now },
      });
      if (count !== 1) throw new UserError("This invitation was just used.", 409);
      const id = newAccount
        ? (
            await tx.user.create({
              data: { email: invitation.email, ...newAccount },
              select: { id: true },
            })
          ).id
        : existing!.id;
      await tx.membership.create({ data: inOrg({ userId: id, role: invitation.role }) });
      return id;
    });
  } catch (error) {
    // The address got an account between reading and writing (another
    // invitation accepted at the same moment): ask them to use that one.
    if ((error as { code?: string }).code === "P2002") {
      throw new UserError(
        `${invitation.email} now has an account. Reload this page and enter its password.`,
        409,
      );
    }
    throw error;
  }

  return createSession(userId, userAgent);
}

/**
 * Runs `fn` with this church's owner list locked, so two owners demoting or
 * removing each other at the same moment cannot leave the church with none.
 */
async function withOwnersLocked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const lockKey = `owners:${requireOrg().orgId}`;
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    return fn(tx);
  });
}

/** Owners can never all go: every church keeps at least one person who can manage it. */
async function assertAnotherOwner(
  tx: Prisma.TransactionClient,
  membershipId: string,
): Promise<void> {
  const owners = await tx.membership.count({
    where: { role: "OWNER", id: { not: membershipId } },
  });
  if (owners === 0) {
    throw new UserError(
      "A church needs at least one owner. Make someone else an owner first.",
      409,
    );
  }
}

/**
 * Cancels invitations someone sent that nobody has accepted yet. Run when they
 * lose the right to invite: an owner who is removed or demoted must not be
 * able to walk back in through an invitation they sent themselves.
 */
async function retireInvitationsFrom(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.invitation.deleteMany({ where: { invitedById: userId, acceptedAt: null } });
}

export async function changeRole(membershipId: string, role: unknown): Promise<void> {
  const next = roleSchema.parse(role);
  await withOwnersLocked(async (tx) => {
    const membership = await tx.membership.findUnique({ where: { id: membershipId } });
    if (!membership) throw new UserError("That person is no longer on the team.", 404);
    if (membership.role === "OWNER" && next !== "OWNER") {
      await assertAnotherOwner(tx, membershipId);
      await retireInvitationsFrom(tx, membership.userId);
    }
    await tx.membership.update({ where: { id: membershipId }, data: { role: next } });
  });
}

/** Removes someone from this church and signs them out of it. Their account stays. */
export async function removeMember(membershipId: string): Promise<void> {
  await withOwnersLocked(async (tx) => {
    const membership = await tx.membership.findUnique({ where: { id: membershipId } });
    if (!membership) return;
    if (membership.role === "OWNER") await assertAnotherOwner(tx, membershipId);
    await retireInvitationsFrom(tx, membership.userId);
    await tx.membership.delete({ where: { id: membershipId } });
    await tx.session.deleteMany({ where: { userId: membership.userId } });
  });
}

/** The same owner lock, for deleting an account (account-recovery.ts), one church at a time. */
export async function lockOwners(tx: Prisma.TransactionClient, orgId: string): Promise<void> {
  const lockKey = `owners:${orgId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}
