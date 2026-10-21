import { execFileSync } from "node:child_process";

/**
 * Points integration tests at TEST_DATABASE_URL and brings its schema up to
 * date with scripts/migrate.mjs. Never DATABASE_URL: a test run must not be able to wipe the database
 * somebody is using.
 */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    if (process.env.CI) throw new Error("TEST_DATABASE_URL must be set in CI.");
    console.warn("[test] TEST_DATABASE_URL not set: skipping integration tests.");
    return;
  }
  // The same runner the Docker image uses on start, so CI exercises it too.
  execFileSync(process.execPath, ["scripts/migrate.mjs", "prisma/migrations"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
