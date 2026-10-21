import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests run anywhere. Integration tests (`*.int.test.ts`) need a Postgres
 * they may wipe, named by TEST_DATABASE_URL; see docs/DEVELOPMENT.md. Without
 * one they are skipped locally and fail in CI, where the variable is set.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    // Integration files share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
