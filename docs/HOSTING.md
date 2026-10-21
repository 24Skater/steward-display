# Hosting Steward Display

Steward Display builds to a self-contained Node server (`.output/server/index.mjs`) and ships
as a Docker image.

## Run with Docker

```sh
docker build -t steward-display .
docker run -d --name steward-display -p 3000:3000 --restart unless-stopped steward-display
```

The container listens on port 3000 (`PORT` overrides it) and reports health through the
image's `HEALTHCHECK`.

## Run without Docker

Requires Bun 1.3+ to build and Node 22+ to run.

```sh
bun install --frozen-lockfile
bun run build
PORT=3000 bun run start   # or: node .output/server/index.mjs
```

## TLS, HSTS and compression

The app does not terminate TLS or compress responses. Put it behind a reverse proxy that does,
for example Caddy:

```caddyfile
display.example.org {
  encode zstd gzip
  header Strict-Transport-Security "max-age=31536000; includeSubDomains"
  reverse_proxy localhost:3000
}
```

On the hosted Steward platform this is the edge proxy's job.

## Search engines

The admin app and Display Views are private. Every response carries
`X-Robots-Tag: noindex, nofollow`, pages carry a robots meta tag, and `robots.txt` disallows
everything. Do not remove these; product marketing belongs on a separate site.

## Platform boundaries

The hosted platform's root domain is configuration (`PLATFORM_ROOT_DOMAIN`), never a source
constant. `scripts/ci/check-platform-boundaries.sh` fails CI on a hardcoded platform domain or
any platform billing credential.

## Data

Current release: screens are stored in each browser's local storage, so a screen built on one
device is not visible on another. Server-side storage, sign-in and TV pairing are the next
phase of work (see the project README).
