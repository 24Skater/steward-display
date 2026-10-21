import { createServerFn } from "@tanstack/react-start";

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
}

/** Who is looking, at which church. Read by the admin layout on every navigation. */
export const getAppState = createServerFn({ method: "GET" })
  .middleware([safeErrors])
  .handler(async (): Promise<AppState> => {
    const org = currentOrg();
    if (!org) return { church: null, viewer: null };
    return { church: { name: org.name }, viewer: await currentViewer() };
  });

export interface SetupInput {
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
    const key = `${clientIp()}|${String(data.email).trim().toLowerCase()}`;
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
