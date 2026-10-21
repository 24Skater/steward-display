# Agent instructions - Steward Display

Read this before changing code. It applies to every coding agent (Claude Code, Codex, Lovable
or anything else).

## What this is

Signage for churches: an **admin app** where screens are built from widgets, and an unattended
**Display View** on a lobby TV. Part of the Steward product family; it must also run standalone
for self-hosters. There is no sign-in yet; it arrives with the server phase.

## Stack

- TanStack Start (React 19, file routes in `src/routes`), Vite 8, Tailwind 4, shadcn/Radix
  (`src/components/ui`), Zustand stores in `src/store`, Bun.
- Builds to a Node server with nitro's `node-server` preset (`vite.config.ts`). **Not
  Cloudflare.** Ships as the Docker image in `Dockerfile`.

## Rules that are easy to break

1. **Never hardcode the platform domain.** It comes from `PLATFORM_ROOT_DOMAIN`.
   `scripts/ci/check-platform-boundaries.sh` enforces this in CI.
2. **Keep private surfaces out of search.** Do not remove the robots meta tag in
   `src/routes/__root.tsx`, the `X-Robots-Tag` headers (`src/server.ts`, `vite.config.ts`
   routeRules) or the disallow-all `public/robots.txt`. Marketing pages do not live here.
3. **No runtime assets from third-party hosts.** Brand files are bundled in `public/`. The TV
   must keep working when the network drops.
4. **No API keys in client code**, local storage or export files. Proxy third-party APIs
   through server functions.
5. **Never show fake or placeholder data on the Display View.** An unconfigured widget renders
   nothing there.
6. **No Supabase / Lovable Cloud.** The planned backend is Postgres + Prisma, matching the other
   Steward apps, with platform modules vendored (copied) rather than imported.
7. **Developer-only server functions** (the contrast audit) must call `assertDevOnly()`.
8. **Screen content is public.** Whatever a Display View shows is broadcast to a room.

## Before committing

```sh
bun run format:check && bun run lint && bun run typecheck && bun run build
sh scripts/ci/check-platform-boundaries.sh
```

Conventional commits (`feat:`, `fix:`, `build:`, `ci:`, `docs:`, ...). Do not rewrite history
that has been pushed.

## Further reading

- `README.md` - status and roadmap
- `docs/HOSTING.md` - deployment
- `SECURITY.md` - reporting and content rules
