import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Builds a Node server (.output/server/index.mjs) so the app runs in Docker
// behind the ecosystem's Caddy edge, like the other Steward apps.
export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  css: { transformer: "lightningcss" },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build"
      ? [
          nitro({
            preset: "node-server",
            routeRules: {
              // Static files bypass src/server.ts, so the noindex header is set here too.
              "/**": { headers: { "x-robots-tag": "noindex, nofollow" } },
              // Vite's hashed build output never changes under the same name.
              "/assets/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
