import { createServerFn } from "@tanstack/react-start";
import { assertDevOnly } from "./dev-only";
import { loadContrastConfig, type ResolvedContrastConfig } from "./contrast.config";

/**
 * Returns the exact same ContrastConfig the CI script resolves, including
 * which JSON file it loaded and which env vars overrode it. Lets the admin
 * UI display the live rules without duplicating the precedence logic.
 */
export const getContrastConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResolvedContrastConfig> => {
    assertDevOnly();
    return loadContrastConfig();
  },
);
