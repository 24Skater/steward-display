# Developing Steward Display

## A database

Any Postgres 16 works. With Docker:

```sh
docker run -d --name steward-display-db -p 5432:5432 \
  -e POSTGRES_USER=display -e POSTGRES_PASSWORD=display -e POSTGRES_DB=display postgres:16-alpine
docker exec steward-display-db psql -U display -c "CREATE DATABASE display_test"
```

Then in `.env`:

```sh
DATABASE_URL="postgresql://display:display@localhost:5432/display"
TEST_DATABASE_URL="postgresql://display:display@localhost:5432/display_test"
```

`bun run db:migrate` applies migrations, and creates a new one when `prisma/schema.prisma`
has changed. Migrations are append-only: never edit one that has been merged.

## Tests

```sh
bun run test
```

Unit tests run anywhere. Integration tests (`*.int.test.ts`) need `TEST_DATABASE_URL`, a
database they are allowed to wipe; without it they are skipped locally and fail in CI. They
bring that database's schema up to date with `scripts/migrate.mjs`, the same runner the Docker
image uses.

## How the server is laid out

- `src/server.ts` wraps every request: it refuses cross-site writes, works out which church the
  hostname belongs to, and runs the rest of the request inside that church.
- `src/server/` is server-only code. The build fails if browser code imports it.
- `src/lib/api/*.functions.ts` are the server functions the admin calls. Each one goes
  through `signedIn` (or `safeErrors`) middleware.
- `src/routes/api.tv.*.ts` are the TV's HTTP endpoints. A TV authenticates with its device
  token, never a cookie.

## Tenancy: the rule that matters most

Every query against a church's data is scoped to the church in context, inside the database
client (`src/server/db.ts`). Forgetting a `where: { orgId }` is not possible; querying with no
church in context throws.

- A new model must be added to `TENANTED_MODELS` or `GLOBAL_MODELS` in
  `src/server/tenancy.ts`. `tenancy.test.ts` fails until it is.
- A tenanted model needs a non-nullable `orgId`. Create rows with `inOrg({ ... })`.
- `bypass()` skips the guard. It is for work about the installation rather than a church:
  resolving the hostname, first-run setup, the global `User` row. Every use says why.
- Nested writes (a `create` inside another model's `data`) are invisible to the guard. Do not
  use them on tenanted models.
- Isolation has tests: `flows.int.test.ts` checks one church cannot read, save or pair into
  another's. Extend them when you add a model.
