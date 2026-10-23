import { createFileRoute } from "@tanstack/react-router";

import { handleProvision } from "@/server/provision";

export const Route = createFileRoute("/api/internal/provision")({
  server: {
    handlers: {
      POST: ({ request }) => handleProvision(request),
    },
  },
});
