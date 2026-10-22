import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { canEmailLinks } from "@/server/account-recovery";
import {
  clientIp,
  enforceLimit,
  limits,
  requireOwner,
  setSessionCookie,
  userAgent,
} from "@/server/http";
import {
  acceptInvitation,
  changeRole,
  describeInvitation,
  inviteMember,
  listTeam,
  removeMember,
  revokeInvitation,
} from "@/server/team";
import { requireOrg } from "@/server/org-context";
import { hashSecret } from "@/server/secrets";
import { safeErrors, signedIn } from "./middleware";

export const getTeamFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .handler(async ({ context }) => ({
    ...(await listTeam()),
    canEmail: canEmailLinks(),
    isOwner: context.viewer.role === "OWNER",
    me: context.viewer.userId,
  }));

export const inviteFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { email: string; role: "OWNER" | "EDITOR" }) => input)
  .handler(({ data, context }) => {
    requireOwner(context.viewer);
    enforceLimit(limits.invite, context.viewer.userId);
    const recipient = String(data.email ?? "")
      .trim()
      .toLowerCase();
    enforceLimit(limits.invitePerRecipient, `${requireOrg().orgId}|${recipient}`);
    return inviteMember(context.viewer, data, new URL(getRequest().url).origin);
  });

export const revokeInvitationFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    requireOwner(context.viewer);
    return { revoked: await revokeInvitation(String(data.id)) };
  });

export const changeRoleFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { membershipId: string; role: "OWNER" | "EDITOR" }) => input)
  .handler(async ({ data, context }) => {
    requireOwner(context.viewer);
    await changeRole(String(data.membershipId), data.role);
    return { ok: true as const };
  });

export const removeMemberFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { membershipId: string }) => input)
  .handler(async ({ data, context }) => {
    requireOwner(context.viewer);
    await removeMember(String(data.membershipId));
    return { ok: true as const };
  });

export const describeInvitationFn = createServerFn({ method: "GET" })
  .middleware([safeErrors])
  .validator((input: { token: string }) => input)
  .handler(({ data }) => describeInvitation(String(data.token)));

export interface AcceptInput {
  token: string;
  name?: string;
  password: string;
}

export const acceptInvitationFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .validator((input: AcceptInput) => input)
  .handler(async ({ data }) => {
    const ip = clientIp();
    enforceLimit(limits.acceptPerIp, ip);
    enforceLimit(limits.acceptPerLink, `${ip}|${hashSecret(String(data.token ?? ""))}`);
    const session = await acceptInvitation(data, userAgent());
    setSessionCookie(session.token, session.expiresAt);
    return { ok: true as const };
  });
