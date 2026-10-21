import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// DATABASE_URL comes from the environment: docker compose sets it in
// production, and a local .env sets it in development. `prisma generate` does
// not need it at all.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
