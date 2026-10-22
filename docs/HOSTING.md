# Hosting Steward Display

Steward Display is one Node server and one Postgres database. It ships as a Docker image and a
`docker-compose.yml` that runs both.

## Run with Docker Compose

```sh
cp .env.example .env      # set POSTGRES_PASSWORD to something long
docker compose up -d
```

Open <http://localhost:3000>. The first visit shows a setup page: a setup code, your church's
name, and the owner's name, email and password. It appears once; after that the page sends
people to sign in.

The setup code proves the person on the setup page also runs the server, so a stranger who
finds a fresh install cannot make themselves its owner. Display prints it in its log:

```sh
docker compose logs app | grep '\[setup\]'
```

Or choose one in advance with `SETUP_CODE` in `.env`.

On every start the container applies any new database migrations, then starts the server. An
up-to-date database makes that a no-op. Set `SKIP_MIGRATIONS=true` to run them some other way.

## Configuration

| Variable                     | Default    | What it does                                                                                  |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | (required) | Postgres connection string. Compose builds it from `POSTGRES_PASSWORD`.                       |
| `POSTGRES_PASSWORD`          | (required) | Compose only: the database password.                                                          |
| `PORT`                       | `3000`     | The port the server listens on (and that compose publishes).                                  |
| `TRUST_PROXY`                | `false`    | `true` behind a reverse proxy: rate limits use `X-Forwarded-For`, cookies honour its `https`. |
| `TRUSTED_PROXY_HOPS`         | `1`        | How many proxies are in front. The visitor is read that many entries from the right.          |
| `BIND_ADDRESS`               | `0.0.0.0`  | Compose only. `127.0.0.1` behind a proxy on the same machine, so nothing can skip it.         |
| `PUBLIC_URL`                 | unset      | The address people use. Needed for emailed links (resets, invitations).                       |
| `EMAIL_SERVER_HOST`          | unset      | SMTP server. With `EMAIL_FROM`, turns on emailed invitations, resets and confirmations.       |
| `EMAIL_SERVER_PORT`          | `587`      | SMTP port; 465 uses TLS from the start.                                                       |
| `EMAIL_SERVER_USER`          | unset      | SMTP username, if the server needs one.                                                       |
| `EMAIL_SERVER_PASSWORD`      | unset      | SMTP password.                                                                                |
| `EMAIL_FROM`                 | unset      | The sender, e.g. `Steward Display <display@yourchurch.org>`.                                  |
| `AUTH0_ISSUER`               | unset      | Steward ID (Auth0) issuer. With the two below, adds "Continue with Steward ID".               |
| `AUTH0_CLIENT_ID`            | unset      | The Auth0 application's client ID.                                                            |
| `AUTH0_CLIENT_SECRET`        | unset      | The Auth0 application's client secret.                                                        |
| `ALLOW_LOCAL_PASSWORD_LOGIN` | `true`     | `false` hides email-and-password sign-in, once everyone uses Steward ID.                      |
| `OPEN_METEO_API_KEY`         | unset      | Open-Meteo's paid key, for commercial use. A church's own install needs none.                 |
| `SETUP_CODE`                 | random     | The code first-run setup asks for. Random and printed in the log when unset.                  |
| `PLATFORM_ROOT_DOMAIN`       | unset      | Hosted Steward platform only. Leave unset on your own server.                                 |

## Pairing TVs

On the TV's browser, open `https://your-display-address/tv`. It shows a six-character code.
Sign in from any phone or computer, open **TVs**, choose **Pair a TV** and type the code. The
code lasts ten minutes; the TV gets a new one by itself.

A paired TV checks for changes about every 30 seconds. Clocks, dates and countdowns on TVs use
the church's time zone from Settings, whatever zone the TV itself is set to. If the network drops it keeps showing
the last screen that loaded, including after a reboot. Unpairing a TV from the TVs page stops
it at its next check and it shows a new code.

Most smart-TV browsers work. For a TV that does not have one, a small streaming stick or a
Raspberry Pi in kiosk mode pointed at `/tv` does.

## TLS, HSTS and compression

The app does not terminate TLS or compress responses. Put it behind a reverse proxy that does,
set `TRUST_PROXY=true`, and set `BIND_ADDRESS=127.0.0.1` so the app's port is not reachable
around the proxy. With Caddy:

```caddyfile
display.example.org {
  encode zstd gzip
  header Strict-Transport-Security "max-age=31536000; includeSubDomains"
  reverse_proxy localhost:3000
}
```

Without TLS, sign-in cookies travel unencrypted. Do not expose Display to the internet over
plain http.

On the hosted Steward platform this is the edge proxy's job.

## Backups

Everything Display knows is in the database: accounts, screens, presets, settings and paired
TVs. Back it up with `pg_dump`, for example nightly from cron on the host:

```sh
docker compose exec -T db pg_dump -U display -Fc display > display-$(date +%F).dump
```

Restore into an empty database with:

```sh
docker compose exec -T db pg_restore -U display -d display --clean --if-exists < display-2026-10-21.dump
```

Keep copies off the machine. A backup you have never restored is a hope, not a backup: try a
restore once into a scratch database.

## Email

Email is optional. With it (`EMAIL_SERVER_*`, `EMAIL_FROM` and `PUBLIC_URL`), owners invite
teammates by email, people reset forgotten passwords themselves, and accounts can confirm their
address. Without it, an invitation gives the owner a link to send however they like, and
passwords are reset with the command below.

`PUBLIC_URL` matters even with email configured: links are never built from the address a
request arrived on, because on a self-hosted install anyone can send a request with any
address, and a reset link pointing at their site would hand them the account.

Any SMTP service works: your church's email provider, or a transactional service such as
Postmark, Resend or Amazon SES.

## Single sign-on

Display can offer **Continue with Steward ID** (Auth0) beside email and password, the same way
Congregation, Table and VBS do. It is one more way in, never a replacement, and without the
three `AUTH0_*` settings nothing about it appears.

1. In Auth0, create a **Regular Web Application** for Display. Add
   `<PUBLIC_URL>/api/auth/sso/callback` to **Allowed Callback URLs**.
2. Set `AUTH0_ISSUER`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` and `PUBLIC_URL`, and restart.

Steward ID never creates an account. Someone signs in with it only if their Steward ID email
belongs to someone already on the church's team, and only once Steward ID has confirmed that
address. Everyone else is asked to get an invitation first.

The first Steward ID sign-in binds that account to that identity. After that, only the same
identity signs in as it, even if another one claims the same confirmed address. In Auth0, enable
only the connections you trust to confirm addresses honestly (usually the Steward database
connection); a connection that marks every address as confirmed would otherwise let its users
claim any account on first use.

Signing out of Display also signs the person out of Steward ID, so the next person on a shared
church computer is not signed straight back in.

Unset `AUTH0_ISSUER` to turn it off; sessions already signed in keep working.

`ALLOW_LOCAL_PASSWORD_LOGIN=false` hides the email-and-password form once everyone uses
Steward ID. Accepting an invitation still asks for a password, which then simply goes unused.
Leave it on until everyone has switched: an Auth0 outage should never lock a church out of
its own screens.

## Weather

The weather widget uses [Open-Meteo](https://open-meteo.com). Only the server talks to it: each place is fetched at most every ten minutes however many screens show it (and left alone for a few minutes after a failed fetch), and TVs get the reading inside the screen data they already poll for, without ever waiting on Open-Meteo. If Open-Meteo is unreachable, the last reading is
used for up to three hours, and after that the widget hides rather than show old weather as
current. The server needs to reach `api.open-meteo.com` and `geocoding-api.open-meteo.com` (with `OPEN_METEO_API_KEY`: `customer-api.open-meteo.com` and `customer-geocoding-api.open-meteo.com`).

Open-Meteo is free for non-commercial use, which covers a church running Display itself. Weather
data is CC BY 4.0; the widget credits Open-Meteo in small print. Commercial use (such as a paid
hosted service) needs an Open-Meteo subscription: set `OPEN_METEO_API_KEY`.

## Resetting a password

Without email, whoever runs the server resets passwords. This sets a new random
password, prints it, and signs that person out everywhere:

```sh
docker compose exec app node tools/reset-password.mjs someone@church.org
```

To choose the password instead, pipe it in: `echo 'a new password' | docker compose exec -T app
node tools/reset-password.mjs someone@church.org`.

## Run without Docker

Requires Bun 1.3+ to build, Node 22+ to run, and Postgres 16.

```sh
bun install --frozen-lockfile
bun run build
DATABASE_URL=postgresql://... node scripts/migrate.mjs
DATABASE_URL=postgresql://... PORT=3000 node .output/server/index.mjs
```

## Search engines

The admin app and TV pages are private. Every response carries `X-Robots-Tag: noindex,
nofollow`, pages carry a robots meta tag, and `robots.txt` disallows everything. Do not remove
these; product marketing belongs on a separate site.

## Platform boundaries

The hosted platform's root domain is configuration (`PLATFORM_ROOT_DOMAIN`), never a source
constant. `scripts/ci/check-platform-boundaries.sh` fails CI on a hardcoded platform domain or
any platform billing credential.
