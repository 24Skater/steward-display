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
}> {
  const state = await getAppState();
  if (!state.church) throw redirect({ to: "/setup" });
  if (!state.viewer) throw redirect({ to: "/login", search: { next: href } });
  return { viewer: state.viewer, church: state.church };
}

/** The signed-in person, inside the admin. */
export function useViewer(): Viewer {
  return useRouteContext({ from: "/_admin" }).viewer;
}

export function useChurch(): { name: string } {
  return useRouteContext({ from: "/_admin" }).church;
}

/** Only same-site paths, so `?next=` can never send someone to another site after signing in. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
