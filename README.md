# Buddha News

A trilingual newsroom for **Buddha Media Group**, built with React 19, Vite 7,
Tailwind 4, Express 4, tRPC 11, Drizzle ORM and MySQL/MariaDB.

- **Readers:** English (`/en/`), Pashto (`/ps/`), Dari (`/fa/`); correct RTL/LTR
  direction, dark and light themes, search, live desk, article pages,
  newsletter, contact form and secure tip line.
- **Newsroom:** Manus OAuth sign-in, Admin and Editor roles, trilingual editor
  with autosave and revision history, media library, inbox, subscribers,
  settings and an audit log.
- **AI:** source-grounded reader assistant, article briefs, and editor drafting
  for headlines, summaries, SEO, tags and first-pass translation. AI output is
  always reviewed by a person and never publishes itself.
- **SEO:** per-language URLs, localized slugs, canonical links, hreflang,
  per-language sitemaps, RSS, Open Graph and JSON-LD generated from a trusted
  `PUBLIC_SITE_URL`, with real HTTP 404s.

> **Demonstration content.** A fresh database can be seeded with 14 fictional
> stories and illustrations so every page can be reviewed. They are labelled
> "Demonstration content", excluded from sitemaps, and marked `noindex`. Replace
> them with real reporting before launch. The contact address is a placeholder
> until you change it in **Newsroom → Settings**.

## Requirements

- Node.js 20 or newer, pnpm 10
- MySQL 8 or MariaDB 10.6+
- A Manus OAuth application for newsroom sign-in (optional for public-only use)
- A transactional email webhook **or** SMTP credentials for newsletter delivery (see `.env.example`)
- Manus managed storage credentials for image uploads

## Quick start

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL, MANUS_JWT_SECRET, PUBLIC_SITE_URL
pnpm db:migrate               # apply migrations 0000-0003
pnpm db:seed                  # optional: 14 clearly labelled demo stories
pnpm dev                      # http://localhost:3000
```

`pnpm dev` runs the Vite middleware and the Express API together. The public
site redirects `/` to `/en/`; the newsroom is at `/admin`.

Production build:

```bash
pnpm typecheck
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

`pnpm start` requires `PUBLIC_SITE_URL` (an exact HTTPS origin),
`MANUS_JWT_SECRET` and `DATABASE_URL`; the process refuses to start otherwise.

## Newsroom access

1. Sign in at `/admin` with Manus OAuth.
2. The account whose email is in `ADMIN_EMAILS` becomes an **Admin**.
3. `EDITOR_EMAILS` grants the **Editor** role: draft and edit stories, upload
   images, view revisions. Editors cannot publish, delete, change settings, read
   subscriber email addresses, or change roles.
4. The **Owner** is the account whose OpenID matches `OWNER_OPEN_ID`. Only that
   account can change roles, and it cannot demote itself. The owner is not a
   fourth database role; it is an environment-level identity.
5. Allowlists are checked against the current account email on every request.
   Removing an address revokes access immediately.

There is no "first visitor becomes admin" rule. Do not enable one.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server with hot reload |
| `pnpm typecheck` / `pnpm check` | TypeScript type check |
| `pnpm build` | Production client and server bundle |
| `pnpm start` | Run the production build |
| `pnpm test` | Vitest suite (116 tests; needs the disposable `buddhanews_test` database) |
| `pnpm db:migrate` | Apply checked-in migrations |
| `pnpm db:seed` | Seed the demonstration newsroom (idempotent) |
| `pnpm db:label-demo` | Label and de-quote demo content in an existing database |
| `pnpm db:search-index` | Add the optional FULLTEXT search index |
| `pnpm db:cleanup` | Run retention cleanup once now (the server also does this daily by itself). Add `-- --mail` to drain the email outbox too |
| `pnpm db:cleanup:prod` | Same, from the built bundle: `node dist/maintenance.js [--mail]` (use this in a platform cron) |
| `pnpm launch:check` | Pre-launch readiness report (demo settings, mail, Turnstile ...). Exits 1 on blockers; `launch:check:prod` runs the built bundle |
| `pnpm db:push` | Generate and apply a schema change (development only) |
| `pnpm db:migrate:prod` | Apply migrations from the built `dist/migrate.js` |

## Configuration

All variables are documented in [`.env.example`](.env.example). The important
ones:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | MySQL/MariaDB connection string |
| `MANUS_JWT_SECRET` | yes in production | Signs the HttpOnly session cookie |
| `PUBLIC_SITE_URL` | yes in production | Trusted HTTPS origin for canonical, sitemap, RSS, OG |
| `PRIVACY_HASH_SECRET` | recommended | Dedicated HMAC key for IP fingerprints and tokens |
| `ADMIN_EMAILS` / `EDITOR_EMAILS` | recommended | Current-state role allowlists |
| `OWNER_OPEN_ID` | recommended | OpenID allowed to change roles (owner identity) |
| `MANUS_OAUTH_*`, `MANUS_API_*` | for OAuth/storage | Platform OAuth and managed storage |
| `NEWSLETTER_FROM_EMAIL`, `EMAIL_WEBHOOK_URL` | for mail | Sender and delivery webhook |
| `SESSION_TTL_HOURS` / `SESSION_IDLE_HOURS` | optional | 12 h absolute / 4 h idle by default |
| `AI_DAILY_CALL_LIMIT` / `AI_DAILY_TOKEN_LIMIT` | optional | Global AI spend caps |
| `ARTICLE_VIEW_RETENTION_DAYS` / `AUDIT_RETENTION_DAYS` | optional | 90 / 365 days |
| `CSP_IMAGE_HOSTS` / `FRAME_ANCESTORS` | optional | Tighten the production CSP |

Never commit `.env`, never bake secrets into a Docker image, and use a separate
database account with only the privileges the app needs.

## Production with Docker

```bash
docker build -t buddhanews .
docker run --rm -p 3000:3000 --env-file .env -e RUN_MIGRATIONS=1 buddhanews
```

The image is multi-stage, runs as uid/gid `10001`, contains only the built
server, client assets and production dependencies, and has a health check
against `/api/health`. Setting `RUN_MIGRATIONS=1` runs `dist/migrate.js` before
starting the server; leave it unset when migrations are applied by a separate
release job. There is no container runtime in the hardening environment, so the
image was not built here; see `DELIVERY_REPORT.md`.

## Project map

```
client/
  index.html                 HTML shell, self-hosted fonts, external theme bootstrap
  public/                    favicon, manifest, fonts, social card, theme-init.js
  src/
    components/site/         masthead, cards, globe, ticker, search, AI, article body
    components/admin/        protected newsroom layout and UI
    contexts/                theme and trilingual dictionary
    pages/                   public pages and admin pages
    index.css                editorial design system, RTL and motion
server/
  _core/                     Express entry, OAuth, sessions, tRPC context, static serving
  config.ts                  Validated runtime configuration
  security.ts                HMAC identifiers, tokens, URL and storage-key validation
  access.ts                  Role resolution and authorization predicates
  rateLimit.ts / aiBudget.ts Throttling and persistent AI spend caps
  db.ts                      Typed data access, revisions, redirects, cleanup
  routers.ts                 Public and newsroom procedures
  newsletterRoutes.ts        Confirmation and unsubscribe links
  mailer.ts                  Outbox and signed email links
  seo.ts                     Metadata, hreflang, sitemaps, RSS, robots, 404s
  seed.ts / seed-cli.ts      Demonstration content and CLI
  scripts/                   label-demo, search-index, cleanup
shared/
  news.ts                    Locales, categories, DTOs, URL and slug helpers
drizzle/
  schema.ts                  Database schema
  0000-0003*.sql             Checked-in migrations
```

## Documentation

- [Security guide](SECURITY_GUIDE.md) — controls, limits, retention, incident response.
- [Migration and rollback](MIGRATION_AND_ROLLBACK.md) — backup, upgrade, verification, rollback.
- [Delivery report](DELIVERY_REPORT.md) — what changed and the actual verification results.
- [Audit report](AUDIT_REPORT.md) — original defects and their resolution.
- [Owner handbook](OWNER_HANDBOOK.md) — day-to-day newsroom operation.
- [Publishing and domain guide](PUBLISHING_AND_DOMAIN_GUIDE.md) — launch, domain, backups.

## Content and privacy notes

- Demo stories are fictional; their bylines are desk/organization names and
  quotations have been removed. They must not be presented as reporting.
- Views are deduplicated per visitor per UTC day using a rotating HMAC
  identifier. Raw IP addresses are not stored.
- Newsletter signup requires confirmation; unsubscribe links are signed and
  single-purpose. The privacy page documents both.
- Article deletion is a soft delete and can be restored by an administrator;
  revisions are retained and restoring one creates a draft.

## Ownership

The application code and database schema belong to the project owner. Manus
hosting, the Manus account, domain registration and third-party services are
separate accounts and subscriptions. Exporting the code does not transfer
Manus-managed OAuth, storage or database services.
