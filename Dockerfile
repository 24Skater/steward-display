# Steward Display - production image.
# Build with Bun (the repo's package manager), run the self-contained nitro
# node-server output on plain Node. The runtime stage needs no node_modules.

FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Root-owned and read-only to the node user: the app has no reason to modify its own code.
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
