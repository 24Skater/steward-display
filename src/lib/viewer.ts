import { redirect, useRouteContext } from "@tanstack/react-router";

import { getAppState } from "@/lib/api/auth.functions";
import type { Viewer } from "@/server/sessions";

export type { Viewer };

/**
 * For a route's `beforeLoad`: the signed-in person, or a redirect to setup
 * (no church yet) or to sign-in (no session), coming back here afterwards.
 */
export async function requireSignedIn(href: string): Promise<{
  viewer: Viewer;
  church: { name: string };
  canEmail: boolean;
}> {
  const state = await getAppState();
  if (!state.church) throw redirect({ to: "/setup" });
  if (!state.viewer) throw redirect({ to: "/login", search: { next: href } });
  return { viewer: state.viewer, church: state.church, canEmail: state.canEmail };
}

/** The signed-in person, inside the admin. */
export function useViewer(): Viewer {
  return useRouteContext({ from: "/_admin" }).viewer;
}

export function useChurch(): { name: string } {
  return useRouteContext({ from: "/_admin" }).church;
}

/** Whether this server can email links (resets, confirmations, invitations). */
export function useCanEmail(): boolean {
  return useRouteContext({ from: "/_admin" }).canEmail;
}

export { safeNext } from "./safe-next";
