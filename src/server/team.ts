import { z } from "zod";

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
 * Invites `email` with `role`. Returns the link, always, so an owner can pass it
 * on themselves when this server cannot send email.
 *
 * `requestOrigin` is the owner's own address bar, used only on a self-hosted
 * install with no PUBLIC_URL. That is safe where it would not be for a password
 * reset: the owner is signed in and sent this request from their own page.
 */
export async function inviteMember(
  inviter: Viewer,
  input: unknown,
  requestOrigin: string,
  now: Date = new Date(),
): Promise<{ link: string; emailed: boolean }> {
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

  const link = `${publicUrl(org.slug) ?? requestOrigin}/invite/${token}`;
  const result = await sendEmail(
    invitationEmail({ to: email, churchName: org.name, inviterName: inviter.name, role, link }),
  );
  return { link, emailed: result.sent };
}

export async function revokeInvitation(id: string): Promise<void> {
  await db().invitation.deleteMany({ where: { id, acceptedAt: null } });
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
        `That isn't the password for ${invitation.email}. Use the one you sign in with elsewhere.`,
        401,
      );
    }
  } else {
    if (!name) throw new UserError("Enter your name.", 400);
    newAccount = { name, passwordHash: await hashPassword(passwordSchema.parse(password)) };
  }

  // All or nothing: marking the invitation used, creating the account and
  // joining. Two tabs accepting at once leave one member and no stray account.
  const userId = await db().$transaction(async (tx) => {
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

  return createSession(userId, userAgent);
}

/** Owners can never all go: every church keeps at least one person who can manage it. */
async function assertAnotherOwner(membershipId: string): Promise<void> {
  const owners = await db().membership.count({
    where: { role: "OWNER", id: { not: membershipId } },
  });
  if (owners === 0) {
    throw new UserError(
      "A church needs at least one owner. Make someone else an owner first.",
      409,
    );
  }
}

export async function changeRole(membershipId: string, role: unknown): Promise<void> {
  const next = roleSchema.parse(role);
  const membership = await db().membership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new UserError("That person is no longer on the team.", 404);
  if (membership.role === "OWNER" && next !== "OWNER") await assertAnotherOwner(membershipId);
  await db().membership.update({ where: { id: membershipId }, data: { role: next } });
}

/** Removes someone from this church and signs them out of it. Their account stays. */
export async function removeMember(membershipId: string): Promise<void> {
  const membership = await db().membership.findUnique({ where: { id: membershipId } });
  if (!membership) return;
  if (membership.role === "OWNER") await assertAnotherOwner(membershipId);
  await db().membership.delete({ where: { id: membershipId } });
  await db().session.deleteMany({ where: { userId: membership.userId } });
}
