import { createServerFn } from "@tanstack/react-start";

import {
  canEmailLinks,
  deleteAccount,
  isResetLinkValid,
  requestPasswordReset,
  resetPassword,
  sendVerification,
  verifyEmail,
} from "@/server/account-recovery";
import { changePassword, setUpInstallation, signIn } from "@/server/accounts";
import {
  clearSessionCookie,
  clientIp,
  currentViewer,
  enforceLimit,
  limits,
  sessionToken,
  setSessionCookie,
  userAgent,
} from "@/server/http";
import { currentOrg } from "@/server/org-context";
import { revokeAllSessions, revokeSession, type Viewer } from "@/server/sessions";
import { safeErrors, signedIn } from "./middleware";

export interface AppState {
  /** Null before first-run setup has created the church. */
  church: { name: string } | null;
  viewer: Viewer | null;
  /** Whether this server can email reset and verification links. */
  canEmail: boolean;
}

/** Who is looking, at which church. Read by the admin layout on every navigation. */
export const getAppState = createServerFn({ method: "GET" })
  .middleware([safeErrors])
  .handler(async (): Promise<AppState> => {
    const org = currentOrg();
    if (!org) return { church: null, viewer: null, canEmail: false };
    return {
      church: { name: org.name },
      viewer: await currentViewer(),
      canEmail: canEmailLinks(),
    };
  });

export interface SetupInput {
  setupCode: string;
  churchName: string;
  name: string;
  email: string;
  password: string;
}

export const setUpFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .validator((input: SetupInput) => input)
  .handler(async ({ data }) => {
    enforceLimit(limits.setup, clientIp());
    const session = await setUpInstallation(data, userAgent());
    setSessionCookie(session.token, session.expiresAt);
    return { ok: true as const };
  });

export interface SignInInput {
  email: string;
  password: string;
}

export const signInFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .validator((input: SignInInput) => input)
  .handler(async ({ data }) => {
    const ip = clientIp();
    const key = `${ip}|${String(data.email).trim().toLowerCase()}`;
    enforceLimit(limits.signInPerIp, ip);
    enforceLimit(limits.signIn, key);
    const session = await signIn(data, userAgent());
    limits.signIn.reset(key);
    setSessionCookie(session.token, session.expiresAt);
    return { ok: true as const };
  });

export const signOutFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .handler(async () => {
    const token = sessionToken();
    if (token) await revokeSession(token);
    clearSessionCookie();
    return { ok: true as const };
  });

/** Signs this person out of every other browser at this church. */
export const signOutEverywhereFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .handler(async ({ context }) => {
    const count = await revokeAllSessions(context.viewer.userId, context.viewer.sessionId);
    return { signedOut: count };
  });

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: ChangePasswordInput) => input)
  .handler(async ({ data, context }) => {
    enforceLimit(limits.signIn, `${clientIp()}|${context.viewer.email}`);
    return changePassword(context.viewer.userId, context.viewer.sessionId, data);
  });

export const forgotPasswordFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    enforceLimit(limits.emailLinks, clientIp());
    const email = String(data.email ?? "")
      .trim()
      .toLowerCase();
    enforceLimit(limits.resetPerEmail, `${currentOrg()?.orgId}|${email}`);
    await requestPasswordReset(data);
    return { ok: true as const };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .validator((input: { token: string; newPassword: string }) => input)
  .handler(async ({ data }) => {
    enforceLimit(limits.emailLinks, clientIp());
    await resetPassword(data);
    return { ok: true as const };
  });

export const resetLinkStatusFn = createServerFn({ method: "GET" })
  .middleware([safeErrors])
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => ({ valid: await isResetLinkValid(data.token) }));

export const verifyEmailFn = createServerFn({ method: "POST" })
  .middleware([safeErrors])
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    enforceLimit(limits.emailLinks, clientIp());
    await verifyEmail(data.token);
    return { ok: true as const };
  });

export const resendVerificationFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .handler(async ({ context }) => {
    enforceLimit(limits.verifyPerUser, context.viewer.userId);
    return { sent: await sendVerification(context.viewer.userId) };
  });

export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { password: string }) => input)
  .handler(async ({ data, context }) => {
    enforceLimit(limits.signIn, `${clientIp()}|${context.viewer.email}`);
    await deleteAccount(context.viewer.userId, data.password);
    clearSessionCookie();
    return { ok: true as const };
  });
