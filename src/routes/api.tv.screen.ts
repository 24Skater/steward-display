import { createFileRoute } from "@tanstack/react-router";

import { handleTvScreen } from "@/server/tv-http";

export const Route = createFileRoute("/api/tv/screen")({
  server: {
    handlers: {
      GET: ({ request }) => handleTvScreen(request),
    },
  },
});
