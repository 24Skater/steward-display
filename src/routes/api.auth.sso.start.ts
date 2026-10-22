import { createFileRoute } from "@tanstack/react-router";

import { clientIp } from "@/server/http";
import { handleSsoStart } from "@/server/sso-flow";

export const Route = createFileRoute("/api/auth/sso/start")({
  server: {
    handlers: {
      GET: ({ request }) => handleSsoStart(request, clientIp()),
    },
  },
});
