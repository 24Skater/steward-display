import { createFileRoute } from "@tanstack/react-router";

import { handlePairStart } from "@/server/tv-http";

export const Route = createFileRoute("/api/tv/pair")({
  server: {
    handlers: {
      POST: ({ request }) => handlePairStart(request),
    },
  },
});
