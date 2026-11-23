# Buddha News Security Guide

This guide describes the controls actually implemented in this repository. It is
written for the person deploying and operating the site, not as a marketing
claim. Where a control depends on an external service or a single-instance
assumption, that is stated explicitly under **Known limitations**.

## 1. Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Send a private report
to the newsroom operator with the affected URL, reproduction steps, and impact.
Do not test against production data, attempt denial of service, or access other
people's accounts. The operator should acknowledge receipt, preserve relevant
logs, and follow the incident checklist in section 12.

## 2. Identity, sessions and CSRF

### OAuth sign-in

Newsroom users sign in with Manus OAuth. The browser starts at
`GET /api/oauth/start`, which:

- creates a random nonce and stores it in an **HttpOnly**, `SameSite=Lax`
  cookie named `bn_oauth_state` (always Secure in production and whenever the
  request is HTTPS);
- accepts only a same-origin relative return path and never an arbitrary
  redirect URI;
- redirects to the configured OAuth portal.

The callback at `/api/oauth/callback` validates the state with a timing-safe
comparison, rejects a missing, replayed, or forged state with `403`, exchanges
the code server-side, and only then issues the application session. OAuth
provider tokens are not placed in `localStorage`, `sessionStorage`, or a URL.

### Application session

The session is a signed JWT in the `webdev_app_session` cookie:

| Property | Value |
| --- | --- |
| Transport | `HttpOnly` cookie only; Bearer tokens are ignored |
| SameSite | `Lax` by default; `None` only with `ALLOW_CROSS_SITE_COOKIES=true` over HTTPS |
| Secure | Always in production; otherwise on HTTPS or when `COOKIE_SECURE=true` |
| Path | `/` |
| Absolute lifetime | `SESSION_TTL_HOURS` (default 12, maximum 720) |
| Idle lifetime | `SESSION_IDLE_HOURS` (default 4, cannot exceed absolute) |
| Revocation | Server-side `sessions` row checked on every authenticated request |

The JWT contains a random session id (`sid`). The server also requires the
matching `sessions` row to exist, be unexpired, unrevoked, and recently active.
Logout marks the row revoked and clears the cookie. An expired, revoked, or
missing row is rejected even when the JWT signature is valid. Passwords are not
stored by this application; authentication is delegated to the OAuth provider.

### CSRF

Every `POST`, `PUT`, `PATCH`, and `DELETE` under `/api` must carry an `Origin`
(or a `Referer` from which an origin can be derived) that matches:

- `PUBLIC_SITE_URL`, or
- an origin in `ALLOWED_ORIGINS`, or
- the exact request host.

A missing, `null`, or foreign origin is rejected with `403` **before** tRPC
parsing. `SameSite=Lax` is a second layer, not a replacement. The OAuth start
and callback routes are GET routes and do not mutate application state without
the state-cookie check.

### Roles and immediate revocation

Roles are resolved live from the database and the current environment
allowlists on every request; they are not frozen into the session token.

| Access level | Capabilities |
| --- | --- |
| Owner (`OWNER_OPEN_ID`) | Everything an admin can do, plus changing other users' roles; cannot demote itself |
| `admin` | Publish/unpublish/delete/restore, settings, subscribers, audit, all editor work |
| `editor` | Create and edit drafts, upload images, view revisions; cannot publish, delete, change settings, read subscriber PII, or change roles |
| `user` | Signed-in reader; no newsroom access |

`ADMIN_EMAILS` and `EDITOR_EMAILS` are comma-separated, case-insensitive
allowlists compared with the account's **current** email. Removing an address
takes effect on the next request, without waiting for cookie expiry. A manual
role granted in the database survives allowlist changes until an operator
removes it; an environment-derived role is demoted as soon as the address
leaves the list. Only the account whose OpenID equals `OWNER_OPEN_ID` can call
`admin.users.setRole`, and that account cannot demote itself. The owner is an
environment-level identity, not a fourth database role. If `OWNER_OPEN_ID` is
empty, no one can change roles until an operator sets it; existing manual role
grants remain effective.

Destructive actions (publish, unpublish, delete, restore, role change) are
owner/admin-only and written to the audit log.

## 3. Privacy-preserving identifiers

Raw IP addresses are not stored in application tables. `server/security.ts`
derives a keyed identifier with HMAC-SHA256 using `PRIVACY_HASH_SECRET`
(falling back to `MANUS_JWT_SECRET` with domain separation). The digest is
truncated to 48 hex characters. For views, the input includes a UTC day and a
coarse user-agent so the value rotates daily and cannot be used to follow a
reader across days.

- Audit rows store `ipHash` and a truncated user agent, never the raw address.
- Contact messages store `ipHash`, not the raw address.
- Newsletter subscriptions store `ipHash`, a hash of the confirmation token,
  and a hash of the unsubscribe token. Token plaintext exists only in the
  emailed link.
- Admin APIs never return token hashes, IP hashes, user agents, or email bodies.
- Application logs are passed through `sanitizeLogValue`; error handlers return
  a generic message and never a stack trace.

`article_views` has a unique key on `(articleId, visitorHash, viewedDay)` and
writes use `INSERT IGNORE`, so a reload cannot inflate the counter. Most-read
rankings use the same deduplicated rows rather than raw request counts.

## 4. Rate limits and AI spend controls

Limits are fixed-window, in-memory, and keyed by the HMAC IP identifier (or by
user id where noted). They are applied before expensive work such as parsing a
large body, calling an AI provider, or writing mail.

| Surface | Limit |
| --- | --- |
| All `/api` requests | 300 per minute per IP |
| OAuth start and callback | 20 per minute per IP |
| Article view | 180 per hour per IP |
| AI summary | 12 per hour per IP |
| AI question | 20 per hour per IP |
| Newsletter subscribe | 6 per hour per IP |
| Contact form | 4 per hour per IP |
| Media upload | 30 per hour per editor/admin |
| Admin AI drafting | 40 per hour per user |
| Storage asset | 240 per minute per IP |
| Confirmation/unsubscribe links | 30 per minute per IP |

The AI budget is persisted in `ai_usage` per UTC day and enforced **before**
the provider call:

- global: `AI_DAILY_CALL_LIMIT` calls (default 500) and
  `AI_DAILY_TOKEN_LIMIT` tokens (default 1,500,000);
- per IP: 60 calls per day;
- per signed-in user: 400 calls per day.

Token usage reported by the provider is recorded after the call; when it is
absent, a conservative character-based estimate is used. A blocked request
returns `429` with a human-readable message and never calls the provider.

## 5. Storage authorization

Uploaded media is stored under a normalized key with no traversal, absolute
path, backslash, or control characters. Keys under `public/` and
`async-images/` are treated as published imagery and may be served to readers.
Everything else is private.

A request to `/manus-storage/<key>` for a private object requires a valid
session. The media row must exist, and the requester must be the uploader or an
administrator; otherwise the response is `403`. Unauthenticated requests get
`401`; unknown keys get `404` rather than leaking existence. The server then
issues a short-lived provider presigned URL and redirects with
`Cache-Control: private, no-store`. Public objects are cached briefly.

Uploads accept only JPEG, PNG, and WebP up to 5 MB. The declared MIME type must
match the file signature; SVG, HTML, and arbitrary binaries are rejected. The
8 MB JSON parser is mounted only on the upload procedure; every other API route
uses a 256 KB limit and URL-encoded bodies are limited to 64 KB. The global
error handler converts oversize bodies to `413` and malformed JSON to `400`.

## 6. Newsletter

Subscriptions use double opt-in:

1. A new address is stored as `pending` with a random confirmation token; only
   its SHA-256 hash is persisted. The token expires after 48 hours.
2. The confirmation email links to `GET /api/newsletter/confirm?id=…&token=…`.
   The route compares hashes, marks the address `subscribed`, records
   `confirmedAt`, and redirects to a localized result page.
3. A confirmation token is single-use; reuse returns an error page.
4. Every message includes a signed unsubscribe link built from the subscriber
   id and an HMAC token. Tampering returns `403`. Unsubscribing is idempotent
   and does not reveal whether an address was ever subscribed.
5. Re-subscribing after unsubscribe puts the existing row back into `pending`
   and requires confirmation again. An already-subscribed address is not
   silently re-confirmed by a third party.

When `EMAIL_WEBHOOK_URL` is unset, messages are written to `email_outbox` and
must be drained by an external worker. Confirmation links are therefore not
lost, but no mail is delivered until a provider is configured.

## 7. Demonstration content

The seeded stories are fictional examples, not reporting. They carry
`articles.isDemo = true` and are:

- labelled with a visible "Demonstration content" banner on the article page;
- excluded from sitemaps;
- marked `noindex` in the HTML and in the page metadata;
- labelled `[Demonstration]` in RSS with a channel-level disclosure;
- stripped of fabricated quotations and misleading bylines at seed time.

`pnpm db:label-demo` applies the same treatment to an existing database that
was seeded before this change. Do not present demo content as news; delete it
before a real launch once genuine stories exist.

## 8. HTTP and browser hardening

Production responses set:

- `Content-Security-Policy` with `default-src 'self'`, `script-src 'self'`
  (no inline scripts, no `unsafe-eval`), `style-src 'self' 'unsafe-inline'`
  (React inline style attributes), `font-src 'self' data:`, `img-src 'self'
  data: blob:` plus `CSP_IMAGE_HOSTS`, `connect-src 'self'`, `frame-src 'self'
  https://www.youtube-nocookie.com`, `frame-ancestors` from
  `FRAME_ANCESTORS` (default `'none'`), and `upgrade-insecure-requests`;
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`;
- `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Cross-Origin-Resource-Policy: same-site`;
- a restrictive `Permissions-Policy` disabling camera, microphone,
  geolocation, payment, USB, and interest cohorts;
- no `X-Powered-By` header.

Fonts are self-hosted under `client/public/fonts` and loaded from first-party
CSS. There is no Google Fonts request, no inline theme script (the theme is
initialized from `public/theme-init.js`), and no broad HTTPS permission. The
CSP is not relaxed with a nonce hash that would also permit injected inline
scripts.

Article HTML is sanitized with DOMPurify before rendering. User-supplied image
URLs must be `https:`, root-relative, or a permitted data image; `javascript:`,
`data:text/html`, and protocol-relative URLs are rejected. External links use
`rel="noopener noreferrer"`. The server never renders user HTML into metadata.

## 9. SEO trust boundary

In production `PUBLIC_SITE_URL` is mandatory, must be `https`, and must be a
bare origin (no path, query, or fragment). Canonical URLs, hreflang, Open Graph
URLs, sitemap locations, RSS links, and `robots.txt` are built only from it.
The `Host` header is never used for these values. `ALLOWED_ORIGINS` is validated
as absolute HTTPS origins at boot. This prevents host-header poisoning from
injecting an attacker domain into search results or share previews.

## 10. Data retention

`pnpm db:cleanup` (also callable through the owner-only maintenance endpoint)
deletes:

- article views older than `ARTICLE_VIEW_RETENTION_DAYS` (default 90);
- audit entries older than `AUDIT_RETENTION_DAYS` (default 365);
- unconfirmed newsletter rows older than
  `NEWSLETTER_PENDING_RETENTION_DAYS` (default 14);
- expired or revoked sessions.

Run it daily from cron or a scheduler. Deleting a story is a soft delete
(`deletedAt`), so the record and its revisions remain available to an
administrator for restore; public queries exclude it. The privacy page
documents these windows and the AI provider disclosure.

## 11. Deployment checklist

1. Generate independent random values for `MANUS_JWT_SECRET` and
   `PRIVACY_HASH_SECRET` (for example `openssl rand -base64 48`). Never commit
   them or bake them into an image.
2. Set `PUBLIC_SITE_URL` to the exact HTTPS origin, and `NODE_ENV=production`.
3. Set `ADMIN_EMAILS` and `EDITOR_EMAILS`, and set `OWNER_OPEN_ID` to the
   account that must be able to change roles.
4. Set `COOKIE_SECURE=true`; leave `ALLOW_CROSS_SITE_COOKIES=false` unless the
   browser and API genuinely live on different sites.
5. Configure `DATABASE_URL` with a least-privilege account and take a backup
   before running migrations. See `MIGRATION_AND_ROLLBACK.md`.
6. Configure `EMAIL_WEBHOOK_URL` and `NEWSLETTER_FROM_EMAIL`, or run an outbox
   worker. Test one confirmation and one unsubscribe end to end.
7. Configure storage credentials (`MANUS_API_URL`, `MANUS_API_KEY`). Without
   them, uploads fail closed and private assets return `404`.
8. Terminate TLS at a trusted proxy and forward the original host and protocol.
   The app trusts one proxy hop (`trust proxy = 1`); do not expose it directly.
9. Run `pnpm db:migrate:prod` (or let the container entrypoint do it), then
   `pnpm db:cleanup` on a schedule.
10. Verify `/api/health`, a private storage URL (`401`), a foreign-origin POST
    (`403`), and a real missing article (`404`) after deployment.

## 12. Incident response

1. **Contain:** remove the affected address from `ADMIN_EMAILS`/`EDITOR_EMAILS`
   and set the account role to `user`; revoke its sessions with
   `UPDATE sessions SET revokedAt = NOW() WHERE userId = ?`. Rotate
   `MANUS_JWT_SECRET` to invalidate every session if compromise is suspected.
2. **Preserve:** export `audit_logs` for the affected actor and time range.
   Audit rows contain keyed hashes and truncated user agents, not raw IPs.
3. **Assess:** review article revisions, media uploads, subscriber changes, and
   outbox entries for the same period. Restoring a revision always creates a
   draft, so nothing is republished without review.
4. **Notify:** follow applicable law and the privacy policy. Do not publish
   personal data from the audit log.
5. **Recover:** rotate `PRIVACY_HASH_SECRET` only if linkability across the
   rotation is acceptable; old view/audit hashes will no longer match new ones.
   Rotate `EMAIL_TOKEN_SECRET` to invalidate outstanding unsubscribe links.
6. **Learn:** add a regression test for the failure mode and update this guide.

## 13. Known limitations

- **Per-process rate limiting unless `REDIS_URL` is set.** Without it, buckets
  live in process memory and each container keeps its own counters. Set
  `REDIS_URL` (or enforce the same limits at the CDN/WAF) before running more
  than one instance. See section 14.
- **No bundled mail provider.** Delivery needs `EMAIL_WEBHOOK_URL` or SMTP
  credentials. The application ships without either; the launch check reports
  a blocker until one is configured.
- **Storage provider required.** Private and public assets need
  `MANUS_API_URL`/`MANUS_API_KEY`; the app fails closed without them.
- **Docker image not built in this environment.** No container runtime was
  available. The Dockerfile is multi-stage, runs as a non-root user, and was
  reviewed and syntax-checked, but `docker build` was not executed here.
- **OAuth depends on the platform.** The callback and token exchange require a
  reachable Manus OAuth service and correct client registration. A local
  deployment without those values cannot sign users in.
- **No Web Application Firewall.** Volumetric attacks must be handled by the
  hosting edge; the application limits are a second line of defence.

## 14. Hardening addendum (bot protection, uploads, mail, retention, accounts)

### Bot protection on public forms
`contact.submit` and `newsletter.subscribe` apply, in this order: per-IP rate
limit, **honeypot**, **Cloudflare Turnstile**.

- Honeypot: the hidden fields `website` (contact) and `company` (newsletter) are
  validated **on the server**. A filled field gets a normal-looking success
  response, but nothing is stored and no email is queued, so bots learn nothing.
  Scripts that skip the HTML form are caught too.
- Turnstile: set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The widget loads
  lazily when a visitor first focuses a form, the CSP allows
  `challenges.cloudflare.com` only while both keys are set, and the token is
  verified with Cloudflare's `siteverify` using the secret key. A missing or
  rejected token is a 400; if Cloudflare cannot be reached the request fails
  **closed** (503) rather than letting bots through.

### Rate limiting with several instances
`checkRateLimitAsync` uses Redis (`REDIS_URL`, atomic Lua script, fixed window)
when configured and falls back to process memory otherwise. If Redis becomes
unavailable the limiter degrades to memory and logs once, so a Redis outage never
takes the site down. Recommended edge rules (Cloudflare WAF > Rate limiting, or
the equivalent on your CDN) in addition to the application limits:

| Path | Suggested limit |
| --- | --- |
| `POST /api/trpc/newsletter.subscribe` | 10 / minute / IP |
| `POST /api/trpc/contact.submit` | 5 / minute / IP |
| `POST /api/trpc/admin.media.upload` | 30 / minute / IP |
| `/api/oauth/*` | 20 / minute / IP |

Set `TRUST_PROXY` to the real number of proxy hops (Cloudflare in front of a load
balancer = 2) and, if the app is reachable only through the CDN, `CLIENT_IP_HEADER`
(for example `CF-Connecting-IP`). A wrong value lets clients spoof their IP and
defeats every per-IP limit.

### Uploads authenticate before the body is parsed
`/api/trpc/admin.media.upload` is mounted behind `uploadGuard` **before** the
8 MB JSON parser. In order it applies: method check, per-IP rate limit,
`Content-Length` (required, max 8 MB, 411/413), `Content-Type` (415), session
authentication (401), role at least editor (403), per-user rate limit (429).
Anonymous callers therefore never make the server buffer or parse a large body.
All other API routes keep the 256 KB default parser. The browser sends uploads
as their own non-batched request so this check sees the exact URL.

### Public storage prefixes
`news/` is now a public prefix, so story images uploaded by earlier versions
(keys like `news/photo.webp`) load for readers again. The check is by path
segment: `newsletter/...` and `private/news/...` stay private.

### Outgoing email
Mail is queued in `email_outbox` and delivered by the built-in worker:
webhook first, SMTP fallback, retry with exponential back-off (2^n minutes, max
6 h), give up after `EMAIL_MAX_ATTEMPTS`, expire after 72 h, delete sent/failed
rows after `EMAIL_OUTBOX_RETENTION_DAYS`. Rows are claimed with a compare-and-swap
so two instances never send the same message. Publish SPF, DKIM and DMARC records
for the domain in `NEWSLETTER_FROM_EMAIL`.

### Retention is automatic
The server runs the retention job daily (and drains the outbox every minute).
A database lock (`_maintenance.lastCleanupAt`) guarantees one run per interval
across instances. On hosts that sleep between requests set
`DISABLE_INTERNAL_SCHEDULER=true` and schedule
`node dist/maintenance.js --mail` (or `pnpm db:cleanup:prod -- --mail`) from the
platform cron: daily for cleanup, and every 5 to 15 minutes if you rely on cron
for mail. The 90-day view retention promised on the Privacy page is
`ARTICLE_VIEW_RETENTION_DAYS`.

### Editor drafts on shared computers
Drafts are saved only in the browser, keyed by user id
(`bn-draft:v2:<userId>:<id>`), expire after 7 days, and are removed on logout, on
a successful save/publish, when the signed-in user changes, and when the session
is lost. Drafts written by older versions (un-scoped keys) are purged on the next
admin visit.

### Spreadsheet formula injection
Subscriber CSV exports prefix any cell that starts with `=`, `+`, `-`, `@` (also
after spaces, tabs, NBSP or zero-width characters) with a single quote before CSV
quoting. See `shared/csv.ts`.

### Admin allow-list and email verification
`ADMIN_EMAILS` / `EDITOR_EMAILS` match the account's *current* email on every
request. New safeguards:
- if the sign-in provider reports `email_verified: false`, the allow-lists are
  ignored for that account (it stays a normal reader unless the owner granted a
  role manually);
- `REQUIRE_VERIFIED_EMAIL=true` additionally requires an explicit `true`.
The Manus OAuth profile currently returns **no** verified-email claim, so the
value is stored as unknown and the default (`false`) keeps existing admins working.
If you add a provider that does report it (Google, Microsoft, GitHub ...), enable
"email verified" there, then set `REQUIRE_VERIFIED_EMAIL=true`. Keep the lists
short and use addresses on a domain you control. The owner (`OWNER_OPEN_ID`) is
never affected.

### Launch guard
`pnpm launch:check`, the boot log, and Admin > Dashboard all show the same
checklist. With `ENFORCE_LAUNCH_CHECKS=true` the server refuses to start while a
blocker remains (placeholder contact address, no mail delivery, placeholder
`PUBLIC_SITE_URL`, nobody allowed to administer the site).
