import { createFileRoute } from "@tanstack/react-router";

import { clientIp } from "@/server/http";
import { handlePairStatus } from "@/server/tv-http";

export const Route = createFileRoute("/api/tv/pair/status")({
  server: {
    handlers: {
      POST: ({ request }) => handlePairStatus(request, clientIp()),
    },
  },
});
