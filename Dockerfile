# Steward Display - production image.
# Build with Bun (the repo's package manager), run the self-contained nitro
# node-server output on plain Node.

FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# The one dependency the server does not bundle: pg, for the two operator
# scripts (migrations on start, password reset). Not the Prisma CLI: it would
# add 250 MB to apply a few SQL files. See scripts/migrate.mjs.
FROM node:22-alpine AS tools
WORKDIR /tools
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund pg@8.23.1

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Root-owned and read-only to the node user: the app has no reason to modify its own code.
COPY --from=build /app/.output ./.output
COPY --from=build /app/prisma/migrations ./prisma/migrations
COPY --from=tools /tools/node_modules ./node_modules
COPY scripts/migrate.mjs scripts/reset-password.mjs ./tools/
COPY scripts/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
