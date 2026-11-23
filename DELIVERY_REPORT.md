# Buddha News — Production Hardening Delivery Report

**Delivery date:** 22 November 2026
**Project:** existing Buddha News trilingual newsroom
**Scope:** modify the real application in place against the 12-section engineering
brief; no replacement template and no separate demo project.
**Release artifact:** `release/buddhanews-hardened.zip`

## 1. Result summary

The application now enforces the requested controls in code and has been
exercised against a real MariaDB database in production mode. The final local
checks are:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Lockfile up to date |
| `pnpm typecheck` (`tsc --noEmit`) | Pass, no errors |
| `pnpm test` (`vitest run`) | **59 passed / 0 failed**, 4 test files |
| `pnpm build` | Pass; client, `dist/index.js`, `dist/migrate.js` produced |
| Production smoke test | Pass on port 3100 against `buddhanews_smoke` |
| Legacy migration test | Pass from `0000` + `0001` data to `0002` + `0003` |
| `docker build` | **Not run** — no container runtime in this environment |

The build emits only chunk-size warnings (the Three.js globe and the main
vendor bundle are large). They are performance warnings, not build failures.

## 2. Security fixes

### 2.1 Demo content is no longer presented as reporting

`articles.isDemo` marks seeded stories. The public article page renders a
visible "Demonstration content" banner, the server injects
`<meta name="robots" content="noindex,follow">`, sitemaps exclude demo rows, and
RSS labels each demo item `[Demonstration]` with a channel disclosure. Seed
content no longer contains fabricated quotations; bylines are desk/organization
names. `pnpm db:label-demo` upgrades an existing seeded database. The AI
question placeholder was changed from a fictional summit question to a neutral
prompt in English, Pashto and Dari.

### 2.2 Privacy-preserving IP handling

The reversible Base64 encoding is gone. `server/security.ts` uses
HMAC-SHA256 with `PRIVACY_HASH_SECRET` (or `MANUS_JWT_SECRET` with domain
separation), truncated to 48 hex characters. View identifiers include the UTC
day and a coarse user agent, so they rotate daily. `article_views` stores only
the HMAC, never a raw address; the unique key
`(articleId, visitorHash, viewedDay)` plus `INSERT IGNORE` makes views
idempotent. Audit and contact rows store keyed hashes. Admin APIs do not return
IP hashes, token hashes, user agents, or email bodies.

### 2.3 Storage authorization

Keys under `public/` and `async-images/` are public imagery. Every other key
requires a valid session **and** ownership by the uploader or an administrator;
otherwise the response is `403`. Unauthenticated private requests return `401`;
unknown keys return `404`. Authorized requests receive a short-lived provider
presigned URL via `302`, with `Cache-Control: private, no-store`. Uploads accept
only JPEG/PNG/WebP, validate magic bytes, cap at 5 MB, and sanitize filenames.
The 8 MB JSON parser is mounted only on the upload route; other API routes use
256 KB, with explicit `413`/`400` handling.

### 2.4 Admin revocation and RBAC

Roles are resolved on every request, not frozen into the cookie. `ADMIN_EMAILS`
and `EDITOR_EMAILS` are compared with the account's current email; removing an
address demotes the account on its next request and revokes its sessions when
it drops to `user`. The owner identity is `OWNER_OPEN_ID`; only that account can
change roles, and it cannot demote itself. Admin can publish, unpublish, delete,
restore, change settings and read subscriber data. Editor can draft, edit,
upload and view revisions but cannot publish, delete, change settings, read
subscriber PII, or change roles. Reader accounts have no newsroom access.
Destructive actions are audited.

### 2.5 Cookie-only sessions and CSRF

The session is a signed JWT in the `webdev_app_session` cookie only; Bearer
tokens are ignored. Cookies are `HttpOnly`, host-only, `SameSite=Lax`, and
`Secure` in production/HTTPS. Absolute lifetime defaults to 12 hours and idle
lifetime to 4 hours. A server-side `sessions` row is required for every request;
logout revokes it immediately, and expired/revoked rows are rejected even with a
valid signature. All unsafe `/api` requests require a trusted `Origin` (or
`Referer`); missing, `null`, or foreign origins get `403`. OAuth state is issued
by `GET /api/oauth/start` in an HttpOnly `bn_oauth_state` cookie and checked
with a timing-safe nonce comparison at the callback.

### 2.6 Rate limits and AI spend

Limits are applied before expensive parsing or provider calls: API 300/min,
OAuth 20/min, views 180/h, AI summary 12/h, AI question 20/h, newsletter 6/h,
contact 4/h, upload 30/h per user, admin AI 40/h, storage 240/min, email links
30/min. The `ai_usage` ledger persists daily totals: 500 calls and 1,500,000
tokens globally, 60 calls per IP, 400 calls per user. A blocked AI request never
reaches the provider.

### 2.7 Trusted SEO origin

`PUBLIC_SITE_URL` is required in production, must be HTTPS, and must be a bare
origin. Canonical links, hreflang, Open Graph, sitemap and RSS are built only
from it; the `Host` header is not used. Production boot refuses an unsafe
configuration.

### 2.8 Newsletter and views

Newsletter signup is double opt-in: pending rows store only a SHA-256 token
hash, confirmation expires after 48 hours, and a single-use link marks the row
subscribed. Unsubscribe links are HMAC-signed; tampering returns `403`.
Re-subscribing after unsubscribe requires confirmation again. Views are
deduplicated and rate-limited; retention is 90 days by default, audit 365 days,
pending subscribers 14 days. `pnpm db:cleanup` enforces all four.

### 2.9 Editorial integrity and history

Every article update writes a revision snapshot. Restore always creates a
draft. The original `publishedAt` is preserved when a story is unpublished.
Slug changes insert a durable redirect and old URLs return `301`. Deletion is a
soft delete (`deletedAt`) and can be restored. The editor autosaves to local
storage, shows a recovery banner, and warns before leaving with unsaved changes.

### 2.10 Content security and frontend safety

Fonts are self-hosted under `client/public/fonts` with a license note; there is
no Google Fonts request. The theme bootstrap is external
(`/theme-init.js`), so production CSP can use `script-src 'self'` with no inline
script hash. CSP also restricts `default-src`, `connect-src`, `frame-src`,
`object-src`, `base-uri`, `form-action`, and `frame-ancestors`; HSTS,
`nosniff`, `Referrer-Policy`, `Permissions-Policy` and
`Cross-Origin-Resource-Policy` are set. Article HTML is sanitized with
DOMPurify; image URLs reject `javascript:`, `data:text/html`, and
protocol-relative values. The error boundary shows a friendly message without a
stack trace. Loading, empty, error and RTL/dark-mode states are retained.

### 2.11 Container and dependency hygiene

The Dockerfile is multi-stage, installs production dependencies separately,
runs as uid/gid `10001`, copies only the built server/client/migrations, has a
`/api/health` health check, and uses an entrypoint that optionally runs
migrations and `exec`s Node for correct signal handling. `.dockerignore`
excludes `.env`, `node_modules`, `dist`, tests, docs, backups, uploads and the
release directory. Unused `@aws-sdk/client-s3` and
`@aws-sdk/s3-request-presigner` dependencies were removed.

## 3. Database changes and migrations

The schema is in `drizzle/schema.ts`; the journal has entries `0000`–`0003`.

`0002_security_hardening.sql` adds:

- `users.role` value `editor`, `roleSource`, `roleUpdatedAt`, email index;
- `sessions` (server-side revocation and idle expiry);
- `articles.isDemo`, `articles.deletedAt`, ranking indexes;
- `article_translations.slug` and unique `(locale, slug)`;
- `article_slug_redirects`;
- `article_revisions`;
- `article_views.visitorHash`, `viewedDay`, dedupe unique index;
- `audit_logs.ipHash`, drops raw `ip`, truncates `userAgent` to 300;
- `media_assets.visibility` and storage-key index;
- newsletter confirmation/unsubscribe hashes, expiry, timestamps, keyed IP hash;
- contact `ipHash`, drops raw `ip`;
- `ai_usage` ledger;
- `email_outbox`.

`0003_backfill_translation_slugs.sql` sets a missing/empty localized slug to
`<english-slug>-<locale>`. It only touches `NULL`/empty values and is
idempotent.

**Verified upgrade path:** a scratch database built from `0000` + `0001` with an
article, three translations, four duplicate views, raw-IP audit/contact rows, a
confirmed subscriber and media was migrated with `pnpm db:migrate`. Results:
4 view rows → 2 deduplicated rows; raw `ip` columns absent; user agent truncated
to 300; `legacy-story-ps`/`legacy-story-fa` slugs backfilled; confirmed
subscriber retained with `confirmedAt`; new tables present. The first run of the
new migrations exposed a trailing empty statement in `0003`; it was removed and
the migration was re-run successfully. This is recorded because it was a real
defect caught by verification, not a claim that the first attempt passed.

## 4. Frontend and backend improvements

Backend:

- `server/config.ts` centralizes and validates runtime configuration.
- `server/access.ts` resolves roles and demotion; `server/security.ts` owns
  HMAC, token, URL and storage-key validation.
- `server/db.ts` adds sessions, safe admin projections, revisions, soft delete,
  slug redirects, view dedupe, sitemap rows, cleanup, most-read and search
  fallback.
- `server/routers.ts` adds RBAC procedures, double opt-in, AI budget, revisions,
  settings and maintenance.
- `server/seo.ts` generates metadata, hreflang, JSON-LD, real 404/503,
  legacy redirects, sitemap index/per-language sitemaps/aliases, RSS and robots.
- `server/_core/index.ts` adds CSP/helmet, body limits, CSRF, API limits,
  storage authorization, health and graceful shutdown.
- `server/_core/sdk.ts` enforces cookie-only sessions, expiry, idle timeout and
  revocation; `sessionAppId()` fixes the empty-audience login bug.
- `server/_core/oauth.ts` implements server-issued state and safe callbacks.
- `server/mailer.ts` writes `email_outbox`, builds confirmation/welcome mail and
  signed unsubscribe URLs; `server/newsletterRoutes.ts` serves the links.

Frontend:

- URL-driven locale routing for `/en/`, `/ps/`, `/fa/`; language switch keeps
  the current path and does not depend on localStorage.
- Article page uses the localized slug, rewrites cross-locale slugs, shows demo
  banner and `noindex` state.
- Admin login copy no longer claims "first visitor becomes owner"; editors can
  sign in to the permitted area.
- Editor supports per-locale slugs, autosave/recovery, unsaved-changes warning,
  revision history and role-aware publish/delete controls.
- Newsletter form explains double opt-in and confirmation.
- Privacy page documents HMAC views, retention, cookies, newsletter and AI.
- Audit/Messages pages no longer display IP-derived values.
- Error boundary, loading/empty/error states and responsive/RTL/dark layouts
  preserved; fonts self-hosted.

SEO/multilingual:

- Localized slugs and canonical URLs; hreflang for `en`, `ps`, `fa-AF` and
  `x-default` (English).
- Per-language sitemaps and `/en|ps|fa/sitemap.xml` aliases; sitemap index.
- Per-language RSS with demo disclosure.
- Multilingual OG/Twitter metadata and honest JSON-LD (desk bylines as
  organizations).
- Real HTTP 404 for missing article/unknown locale; no soft 404.
- Legacy article URLs redirect to `/en/`; old slugs 301 to the current localized
  slug; missing translations redirect to English.

## 5. Files changed

### Documentation and configuration

`.env.example`, `README.md`, `SECURITY_GUIDE.md`, `AUDIT_REPORT.md`,
`MIGRATION_AND_ROLLBACK.md` (new), `DELIVERY_REPORT.md` (new), `TODO.md`,
`PROJECT_NOTES.md`, `OWNER_HANDBOOK.md`, `PUBLISHING_AND_DOMAIN_GUIDE.md`,
`Dockerfile`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`,
`vitest.config.ts`.

### Database

`drizzle/schema.ts`, `drizzle/meta/_journal.json`,
`drizzle/0002_security_hardening.sql` (new),
`drizzle/0003_backfill_translation_slugs.sql` (new).

### Server

New: `server/config.ts`, `server/security.ts`, `server/access.ts`,
`server/rateLimit.ts`, `server/aiBudget.ts`, `server/mailer.ts`,
`server/newsletterRoutes.ts`, `server/migrate.ts`, `server/scripts/label-demo.ts`,
`server/scripts/search-index.ts`, `server/scripts/cleanup.ts`,
`server/test/globalSetup.ts`, `server/test/helpers.ts`, `server/app.test.ts`,
`server/security.test.ts`.

Modified: `server/_core/index.ts`, `server/_core/sdk.ts`,
`server/_core/context.ts`, `server/_core/trpc.ts`, `server/_core/oauth.ts`,
`server/_core/cookies.ts`, `server/_core/env.ts`, `server/_core/vite.ts`,
`server/db.ts`, `server/routers.ts`, `server/seo.ts`, `server/seed.ts`,
`server/audit.ts`, `server/auth.logout.test.ts`, `server/platform.test.ts`.

### Client

`client/index.html`, `client/src/index.css`, `client/src/App.tsx`,
`client/src/const.ts`, `client/src/main.tsx`,
`client/src/_core/hooks/useAuth.ts`,
`client/src/contexts/I18nContext.tsx`, `client/src/hooks/usePageMeta.ts`,
`client/src/lib/news.ts`,
`client/src/components/ErrorBoundary.tsx`,
`client/src/components/admin/AdminLayout.tsx`,
`client/src/components/site/ArticleCard.tsx`,
`client/src/components/site/Logo.tsx`,
`client/src/components/site/NewsletterForm.tsx`,
`client/src/components/site/SearchDialog.tsx`,
`client/src/components/site/SiteFooter.tsx`,
`client/src/components/site/SiteHeader.tsx`,
`client/src/components/site/Ticker.tsx`,
`client/src/pages/About.tsx`, `Article.tsx`, `Category.tsx`, `Contact.tsx`,
`Home.tsx`, `NotFound.tsx`, `Privacy.tsx`, `Search.tsx`, `TipLine.tsx`,
`client/src/pages/admin/AdminLogin.tsx`, `ArticleEditor.tsx`, `Audit.tsx`,
`Messages.tsx`.

New assets: `client/public/fonts/fraunces-latin-var.woff2`,
`manrope-latin-var.woff2`, `vazirmatn-arabic-var.woff2`,
`vazirmatn-latin-var.woff2`, `client/public/fonts/LICENSES.md`,
`client/public/theme-init.js`.

### Shared and tests

`shared/const.ts`, `shared/news.ts`; `server/app.test.ts`,
`server/security.test.ts`, `server/auth.logout.test.ts`,
`server/platform.test.ts`.

## 6. Actual verification evidence

### Automated tests

`pnpm test` — 59 passed, 0 failed, 4 files:

- `server/app.test.ts` — 36 integration tests: health, CSRF, body limits, OAuth
  state, storage auth/ownership, API 404, cookie-only auth, logout revocation,
  expired session, role demotion, anonymous/reader denial, editor draft vs
  publish, admin publish/delete, owner-only role change, no secret fields,
  upload rejection, revisions/restore, publication-date preservation, slug
  redirect, view dedupe, newsletter confirm/unsubscribe, localized URLs,
  cross-locale redirect, legacy redirect, real 404, demo noindex, sitemap/RSS,
  robots.
- `server/security.test.ts` — 17 unit tests for HMAC/token/URL/storage-key
  helpers.
- `server/platform.test.ts` — 5 tests for public config and storage URL
  handling.
- `server/auth.logout.test.ts` — 1 test for hardened cookie/session behavior.

### Type check and build

- `pnpm typecheck` — clean.
- `pnpm build` — `dist/public` client build, `dist/index.js` (387.9 KB),
  `dist/migrate.js` (617 B). Warnings only for chunks over 500 KB.

### Production smoke test

Command context: `NODE_ENV=production`, port 3100, `PUBLIC_SITE_URL=https://news.example.com`,
seeded `buddhanews_smoke` database, OAuth portal/project variables set. Results:

| Request | Result |
| --- | --- |
| `/` | `302` → `/en/` |
| `/en/`, `/ps/`, `/fa/` | `200`, correct `lang`/`dir` |
| `/en/article/regional-summit-border-security-accord` | `200`, canonical/hreflang, demo `noindex` |
| `/ps/article/<localized-slug>` | `200` |
| `/en/article/<Pashto-slug>` | `301` → localized English slug |
| `/en/article/no-such-story` | `404`, real not-found page with `<noscript>` |
| `/xx/` | `404` |
| `/sitemap.xml`, `/en/sitemap.xml` | `200`; demo slug absent from sitemap |
| `/en/rss.xml` | `200`; demo items labelled `[Demonstration]` |
| `/robots.txt` | `200`; sitemap uses `https://news.example.com` |
| `/fonts/manrope-latin-var.woff2` | `200` |
| `/manus-storage/public/news/missing.webp` | `404` (storage provider absent, fail closed) |
| `/api/health` | `200` |
| OAuth start with project/portal configured | `302`, `Set-Cookie: bn_oauth_state=…; HttpOnly; Secure; SameSite=Lax` |
| POST with missing/foreign Origin | `403` |
| 300 KB POST | `413` |
| CSP/HSTS/nosniff/referrer/Permissions-Policy | Present |

Newsletter subscribe → confirm → unsubscribe → resubscribe, token reuse,
tampered unsubscribe, role demotion, expired session, private storage `401`,
editor `403` on publish/settings/subscribers, and admin publish/delete were also
exercised during the hardening run and are covered by the 59-test suite.

### Legacy migration verification

As described in section 3: `0000` + `0001` fixture → `0002` + `0003`, with
dedupe, column removal, truncation, slug backfill and confirmed-subscriber
backfill all verified in MariaDB 10.11.14.

## 7. Docker status

**Not executed.** The environment has no `docker` or `podman` binary. The
Dockerfile and entrypoint were reviewed and the build output paths were checked
(`dist/index.js`, `dist/migrate.js`, `drizzle/`), but an actual image build and
container start remain an operator verification step. This is called out rather
than claimed as passed.

## 8. Unresolved issues and external requirements

1. **Docker build not run** — see above.
2. **Rate limiting is per process.** The limiter is in-memory; multiple
   containers each have independent buckets. The persistent AI ledger still
   caps total AI spend. Use Redis or an edge WAF before horizontal scaling.
3. **Mail delivery needs a provider.** (Updated: a delivery worker now ships; see CHANGES_V2.md.) Messages queue in `email_outbox`; set
   `EMAIL_WEBHOOK_URL`/`EMAIL_WEBHOOK_TOKEN` or run an outbox worker. No SMTP
   credentials are bundled.
4. **Storage needs credentials.** `MANUS_API_URL`/`MANUS_API_KEY` are required
   for uploads and signed URLs; without them the app fails closed.
5. **OAuth needs a registered Manus application.** `MANUS_PROJECT_ID`,
   `MANUS_OAUTH_API_URL` and `MANUS_OAUTH_PORTAL_URL` must be valid; the start
   route returns `503` with a clear message when they are absent.
6. **Real content and images.** The 14 stories are demonstration content and
   remain labelled/noindexed. Replace them before launch; demo images are
   AI-generated placeholders.
7. **AI output can be wrong.** All AI actions are draft-only; human review is
   required for names, numbers, quotes and translations.

## 9. Required environment variables

Required in production: `DATABASE_URL`, `MANUS_JWT_SECRET`, `PUBLIC_SITE_URL`.

Recommended: `PRIVACY_HASH_SECRET`, `ADMIN_EMAILS`, `EDITOR_EMAILS`,
`OWNER_OPEN_ID`, `COOKIE_SECURE=true`, `NEWSLETTER_FROM_EMAIL`.

For OAuth: `MANUS_PROJECT_ID`, `MANUS_OAUTH_API_URL`,
`MANUS_OAUTH_PORTAL_URL`. For storage: `MANUS_API_URL`, `MANUS_API_KEY`. For
mail: `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN` (optional
`EMAIL_TOKEN_SECRET`).

Optional controls: `SESSION_TTL_HOURS` (12), `SESSION_IDLE_HOURS` (4),
`ALLOW_CROSS_SITE_COOKIES` (false), `COOKIE_DOMAIN`, `ALLOWED_ORIGINS`,
`TRUSTED_HOSTS`, `AI_DAILY_CALL_LIMIT` (500), `AI_DAILY_TOKEN_LIMIT` (1500000),
`ARTICLE_VIEW_RETENTION_DAYS` (90), `AUDIT_RETENTION_DAYS` (365),
`NEWSLETTER_PENDING_RETENTION_DAYS` (14), `CSP_IMAGE_HOSTS`,
`FRAME_ANCESTORS`, `PORT`, `NODE_ENV`, `SEED_ON_START`.

`MANUS_PROJECT_ID` may be empty for session verification (stable fallback
`buddhanews`), but OAuth start needs a real project id. `OWNER_OPEN_ID` is an
identity, not a database role; if empty, no one can change roles until set.

## 10. Deployment steps

1. Back up the database (see `MIGRATION_AND_ROLLBACK.md`), including a restore
   test.
2. Set the production environment variables. Generate independent
   `MANUS_JWT_SECRET` and `PRIVACY_HASH_SECRET` values; never commit `.env`.
3. Build the release artifact: `pnpm install --frozen-lockfile && pnpm build`.
4. Apply migrations with `pnpm db:migrate` or `pnpm db:migrate:prod`, or run the
   container with `RUN_MIGRATIONS=1`.
5. Start with `NODE_ENV=production pnpm start` (or the Docker image). The
   process refuses to start without `PUBLIC_SITE_URL`, `MANUS_JWT_SECRET` and
   `DATABASE_URL`.
6. Verify `/api/health`, `/en/`, `/ps/`, `/fa/`, a localized article, a missing
   article (`404`), `/sitemap.xml`, `/en/rss.xml`, `/robots.txt`, a private
   storage URL (`401`), a foreign-origin POST (`403`), and a 300 KB POST
   (`413`).
7. Sign in as the owner, create a draft, publish, rename the slug, confirm the
   old URL `301`s, soft-delete, restore the revision, and verify an editor
   cannot publish or open subscribers.
8. Schedule `pnpm db:cleanup` daily and configure mail/storage credentials.
9. Submit the sitemap and verify the production domain in Search Console/Bing.

## 11. Migration and rollback

Full detail is in [MIGRATION_AND_ROLLBACK.md](MIGRATION_AND_ROLLBACK.md).
Summary:

- Take a `mysqldump --single-transaction --routines --triggers` backup and
  restore it into a scratch database before touching production.
- `0002` is additive except for the deliberate removal of raw IP columns,
  duplicate view rows, and over-long user-agent truncation.
- `0003` backfills missing localized slugs.
- The preferred rollback is restoring the pre-migration backup into a new
  database and pointing `DATABASE_URL` at it, then redeploying the previous
  build. A schema-only reverse SQL is included for emergencies but cannot
  restore dropped raw IP values or duplicate views.

## 12. Release ZIP contents

`release/buddhanews-hardened.zip` contains the application source, migrations,
tests, Docker files and documentation. It excludes `node_modules`, `.env`,
`dist`, `.git`, `.backup-original`, `release`, local uploads, logs and scratch
files. See the ZIP listing in the final response for the top-level contents.

## 13. Honest statement

Every test, type check, build and smoke result above was actually run in this
environment. Docker was not built because no runtime is available; that is the
one requested verification that could not be performed here. No claim is made
that the application is "unhackable"; the residual risks are listed in section
8 and in `SECURITY_GUIDE.md`.
