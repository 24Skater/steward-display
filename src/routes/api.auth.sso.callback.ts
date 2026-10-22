import { createFileRoute } from "@tanstack/react-router";

import { clientIp, userAgent } from "@/server/http";
import { handleSsoCallback } from "@/server/sso-flow";

export const Route = createFileRoute("/api/auth/sso/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleSsoCallback(request, clientIp(), userAgent()),
    },
  },
});
