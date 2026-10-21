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

/** Backslashes and control characters (tab, newline): what browsers rewrite in a URL. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const REWRITTEN_BY_BROWSERS = /[\\\u0000-\u001f]/;

/**
 * Only paths on this site, so `?next=` can never send someone elsewhere after
 * signing in. Resolved the way a browser would: `/\evil.com` and a path with a
 * tab in it both become `//evil.com` in a browser, so both are refused.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || REWRITTEN_BY_BROWSERS.test(next)) return "/";
  try {
    const base = "http://this-site.invalid";
    const url = new URL(next, base);
    return url.origin === base && next.startsWith("/") ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
