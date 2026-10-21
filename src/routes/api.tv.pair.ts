import { createFileRoute } from "@tanstack/react-router";

import { clientIp } from "@/server/http";
import { handlePairStart } from "@/server/tv-http";

export const Route = createFileRoute("/api/tv/pair")({
  server: {
    handlers: {
      POST: ({ request }) => handlePairStart(request, clientIp()),
    },
  },
});
