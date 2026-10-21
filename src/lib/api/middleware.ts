import { createMiddleware } from "@tanstack/react-start";

import { toUserError } from "@/server/errors";
import { requireViewer } from "@/server/http";

/**
 * Every server function's errors pass through here: a UserError reaches the
 * browser as written, anything else is logged and replaced with a generic
 * message, so internals never leak into a toast.
 */
export const safeErrors = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    throw toUserError(error);
  }
});

/** Server functions only a signed-in member of this church may call. */
export const signedIn = createMiddleware({ type: "function" })
  .middleware([safeErrors])
  .server(async ({ next }) => next({ context: { viewer: await requireViewer() } }));
