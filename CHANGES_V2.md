# Buddha News: 14-point hardening pass (v2)

Everything below is implemented in this project and verified with `pnpm typecheck`, `pnpm test` (116 tests, up from 59), `pnpm build`, a legacy-data migration run, the built CLI tools, and a headless-browser smoke test of the production build.

## Part 1: What changed, item by item

| # | Item | What was done | Where |
| --- | --- | --- | --- |
| 1 | `news/` uploads returned 401 | `news/` added to the public storage prefixes. Matching is by path segment, so `newsletter/...` and `private/news/...` stay private. | `server/security.ts`, tests in `security.test.ts` and `hardening.test.ts` |
| 2 | 90-day retention only ran by hand | Built-in scheduler: retention cleanup daily (interval configurable), outbox every minute, first run 30 s after boot. A database lock allows one run per interval across instances. CLI `node dist/maintenance.js [--mail]` for platform cron, with `DISABLE_INTERNAL_SCHEDULER=true` to turn the internal timer off. | `server/scheduler.ts`, `server/maintenance.ts`, `server/scripts/maintenance.ts` |
| 3 | Confirmation emails never sent | Delivery worker: webhook first, SMTP (nodemailer) fallback, exponential back-off, max attempts, 72 h expiry, claim-by-compare-and-swap, outbox retention. Mail stays queued if nothing is configured, and the launch check calls that a blocker. | `server/mailDelivery.ts`, `server/mailer.ts`, migration 0005 |
| 4 | Weak bot protection | Server-side honeypot on `contact.submit` (`website`) and `newsletter.subscribe` (`company`): fake success, nothing stored, no mail. Cloudflare Turnstile verified server-side, fail-closed, lazy widget, CSP opened only when keys are set. Rate limiting through Redis (`REDIS_URL`) with in-memory fallback; `TRUST_PROXY` and `CLIENT_IP_HEADER` for real client IPs. Edge rules are documented in `SECURITY_GUIDE.md` section 14. | `server/botProtection.ts`, `server/rateLimit.ts`, `client/src/components/site/TurnstileWidget.tsx` |
| 5 | Upload parsed 8 MB before auth | `uploadGuard` runs before the JSON parser: method, per-IP limit, Content-Length (411/413), content type (415), authentication (401), role at least editor (403), per-user limit (429). The browser sends uploads on a non-batched link so the guard sees the exact URL. | `server/_core/uploadGuard.ts`, `server/_core/index.ts`, `client/src/main.tsx` |
| 6 | Editor drafts leaked across users | Keys are `bn-draft:v2:<userId>:<id>`, with a 7-day TTL. Cleared on logout, on save/publish, when the user changes, and when the session is lost. Legacy un-scoped keys are purged. | `client/src/lib/drafts.ts`, `ArticleEditor.tsx`, `useAuth.ts`, `AdminLayout.tsx` |
| 7 | CSV formula injection | Cells starting with `= + - @` (also after spaces, tabs, NBSP, zero-width characters) get a leading `'` before CSV quoting. | `shared/csv.ts`, `Subscribers.tsx`, `server/csv.test.ts` |
| 8 | Demo settings / launch guardrails | Placeholder defaults removed (contact email is empty until set, the footer, contact page, Privacy page and JSON-LD hide it when empty). Launch readiness check in three places: boot log, `pnpm launch:check` (exit 1 on blockers), and an Admin Dashboard checklist card. `ENFORCE_LAUNCH_CHECKS=true` refuses to boot while blockers remain. | `server/launchCheck.ts`, `shared/demo.ts`, `LaunchChecklist.tsx` |
| 9 | `data-loc` in production | `jsxLocPlugin` loads only for `vite serve` in development. `grep -r data-loc dist/public` finds nothing, and the browser smoke test counted 0 `[data-loc]` elements. | `vite.config.ts` |
| 10 | Caching and bundle size | Public story lists and "most read" cached for 30 s (`PUBLIC_CACHE_TTL_SECONDS`), single-flight, cleared on create, edit, delete, restore and AI summary. Vendor chunks (react, data, ui, charts, three). `AdminLayout` and all admin pages lazy-loaded. framer-motion replaced with a 40-line CSS/IntersectionObserver reveal. Entry chunk went from 787 KB to 248 KB (241 KB to 76 KB gzip). | `server/cache.ts`, `vite.config.ts`, `App.tsx`, `lib/useReveal.ts` |
| 11 | Unused deps and files | Removed 15 legacy/Manus files (AIChatBox, DashboardLayout(+Skeleton), ManusDialog, Map, ComponentShowcase, 3 hooks, 5 `server/_core` modules, `shared/types.ts`), 50 unreferenced shadcn UI files (3 remain in use), and 42 dependencies including `add`, `framer-motion`, `postcss`, `autoprefixer`, 24 unused Radix packages. | `package.json` |
| 12 | Pashto/Dari TTS | `speechSynthesis.getVoices()` with the async `voiceschanged` event and a 1.5 s settle timer. Pashto needs `ps*` (or `pus*`); Dari prefers `fa-AF`, then `prs*`, then any `fa*`; English prefers `en-US`. The Listen button is not rendered when there is no matching voice, and the chosen voice is set on the utterance. | `client/src/lib/speechVoices.ts`, `Article.tsx` |
| 13 | DB normalisation | Migration 0004: orphan cleanup, `categories` lookup (8 active keys, unknown legacy values kept as inactive), `tags` + `article_tags` (CSV migrated: trimmed, de-duplicated, ordered), foreign keys with CASCADE / SET NULL / RESTRICT. Legacy `articles.tags` column kept and dual-written for rollback. API rejects unknown categories. | `drizzle/0004_*.sql`, `drizzle/schema.ts`, `MIGRATION_AND_ROLLBACK.md` section 7 |
| 14 | Minor | RSS `<link>` follows the page language (`/ps/rss.xml`, `/fa/rss.xml`). `users.emailVerified` stored; an explicit `email_verified: false` stops `ADMIN_EMAILS`/`EDITOR_EMAILS` from matching; `REQUIRE_VERIFIED_EMAIL=true` demands an explicit `true`. The Manus OAuth profile sends no verified-email claim today, so the flag defaults to off. | `server/seo.ts`, `server/access.ts`, `server/emailVerification.ts` |

### Bundle result (production build)

| | Before | After |
| --- | --- | --- |
| Entry chunk `index-*.js` | 787 KB (241 KB gzip) | 248 KB (76 KB gzip) |
| JS needed for a first public page view (entry + react + data + ui chunks) | about 787 KB / 241 KB gzip | 627 KB / 196 KB gzip |
| Admin code in public bundles | yes (AdminLayout) | no, lazy chunks only |
| Charts (recharts, 392 KB) and three.js (531 KB) | loaded on demand | still on demand, now in cacheable vendor chunks |

## Part 2: What you still have to do

### A. Cloudflare Turnstile (item 4)
1. Cloudflare dashboard > Turnstile > Add widget, add your domain.
2. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (both, or neither). Restart.

### B. Email delivery (item 3). Use at least one channel
- Webhook: `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN`. It receives `POST` JSON `{to, from, subject, text, kind}` with `Authorization: Bearer <token>`.
- SMTP: `SMTP_URL` (for example `smtps://user:pass@smtp.example.com:465`) or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`.
- `NEWSLETTER_FROM_EMAIL`: an address on a domain with SPF and DKIM (and ideally DMARC) published.
- Optional: `EMAIL_MAX_ATTEMPTS` (8), `EMAIL_OUTBOX_RETENTION_DAYS` (30).

### C. Admin > Settings values (item 8)
`contactEmail`, `ogImage` (real 1200x630 image, not `/manus-storage/async-images/...`), `tipSignal`, `youtubeUrl`, `twitterUrl`, `facebookUrl`, `liveStreamUrl`, `announcement`. Also unpublish or delete the labelled demo stories and keep `SEED_ON_START=false`. The Dashboard checklist turns green when these are done.

### D. Environment / platform
- Run the migrations: `RUN_MIGRATIONS=1` on container start, or `pnpm db:migrate:prod`. Back up first. This applies 0004 and 0005.
- `PUBLIC_SITE_URL` (real https origin), `ADMIN_EMAILS`, `OWNER_OPEN_ID`. Optional `EDITOR_EMAILS`.
- More than one instance: `REDIS_URL`, or equivalent edge rate-limit rules (table in `SECURITY_GUIDE.md` section 14), plus the right `TRUST_PROXY` (Cloudflare in front of a load balancer = 2) and, if only reachable through the CDN, `CLIENT_IP_HEADER=CF-Connecting-IP`.
- Optional: `REQUIRE_VERIFIED_EMAIL=true` once your login provider sends a verified-email claim; `ENFORCE_LAUNCH_CHECKS=true` to block boot while blockers remain; `PUBLIC_CACHE_TTL_SECONDS`.
- Existing story categories outside the 8 standard ones become inactive categories after the migration. Run `SELECT slug FROM categories WHERE active = 0;` and re-map those stories if any appear.

### E. Scheduling (item 2)
- Always-on server or container: nothing to do. The server cleans up daily and sends mail every minute.
- Hosts that sleep when idle: set `DISABLE_INTERNAL_SCHEDULER=true` and create two platform cron jobs:
  - daily: `node dist/maintenance.js`
  - every 10 minutes: `node dist/maintenance.js --mail`
- Keep `ARTICLE_VIEW_RETENTION_DAYS=90` while the Privacy page says 90 days.

## Part 3: Verification record
- `pnpm typecheck`: clean.
- `pnpm test`: 7 files, 116 tests pass (new: upload guard over HTTP, honeypot, Turnstile with mocked Cloudflare, webhook/SMTP/back-off/give-up, scheduler race, Redis-style store, cache invalidation, tag/category relations and cascades, email-verification rules, RSS per language, launch checks, CSV, TTS voice matching).
- `pnpm build`: succeeds; no `data-loc` in `dist/public`; admin strings absent from the entry chunk.
- Migration 0004/0005 run against a database seeded with legacy data (orphans, CSV tags with duplicates/blanks, unknown category, dangling author ids).
- `node dist/maintenance.js --mail` and `node dist/launch-check.js` run from the built bundle.
- Headless Chromium on the production build: `/en/`, `/ps/`, `/fa/` RSS links correct, zero console errors, honeypot not visible, Listen button hidden without a matching voice and shown when a `ps-AF` voice is present (and still hidden for Dari when only `ps`/`en` voices exist).

Not verified here: delivery to a real mail provider, a live Turnstile challenge (needs your keys and domain), Redis (no server available; the store contract is tested with a fake), and `docker build` (no container runtime).

---

## Addendum: DevTools-style audit fixes (mobile, desktop, RTL)

| # | Where | Problem | Fix |
|---|-------|---------|-----|
| 1 | `server/db.ts` `getMostRead` | `articles.mostRead` returned HTTP 500 on every home load: the raw-SQL `recentViews` field had no `AS` alias, so `ORDER BY recentViews` hit "Unknown column". The subquery also compared `v.articleId` to a bare `id`, which binds to `article_views.id`. | `.as("recentViews")` and an explicit `` `articles`.`id` ``. Regression test added. |
| 2 | `ArticleCard.tsx`, `Home.tsx`, `Category.tsx` | Home page had no `<h1>`. | New `headingAs` prop; Home hero is `h1`, Category lead is `h2`. |
| 3 | `SiteHeader.tsx` (x2), `Home.tsx`, `Contact.tsx`, `TipLine.tsx` | The text arrow `→` pointed the wrong way in Pashto/Dari. | Wrapped in `<span aria-hidden class="inline-block rtl:-scale-x-100">`. |
| 4 | `index.css` | `th` was centred over start-aligned cells (Privacy table, admin tables). | `@layer base { th { text-align: inherit } }`; Privacy table uses `text-start`. |
| 5 | `index.css` | Inputs below 16px made iOS Safari zoom on focus. | `@media (pointer: coarse)` sets text fields to 16px. |
| 6 | `About.tsx` | `/manus-storage/...` image gives a broken image where storage is not configured. | `onError` falls back to `/og-fallback.svg`. |

Not changed (needs owner/translator input): Contact, Tip line, About and policy pages still contain English-only paragraphs in the Pashto/Dari views.
