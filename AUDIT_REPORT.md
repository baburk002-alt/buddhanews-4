# Buddha News — Audit and Remediation Report

**Original artifact:** `buddha_news_interactive_multilingual_preview(1).html`
(35,705 bytes), a single-page visual preview.
**Current artifact:** this repository, a React/Express/Drizzle newsroom.
**Original audit:** 13 November 2026.
**Production-hardening pass:** 22 November 2026.

The original file was a strong visual concept but not a functioning news site.
The rebuild kept its trilingual navigation, lead story, live desk, dark mode and
tip line, then replaced the parts that could not run safely. This report records
both the original defects and the later hardening pass; the authoritative list
of current controls is [SECURITY_GUIDE.md](SECURITY_GUIDE.md), and the actual
verification results are in [DELIVERY_REPORT.md](DELIVERY_REPORT.md).

## 1. Original content and product defects

| Finding | Why it mattered | Current resolution |
| --- | --- | --- |
| Eight hardcoded stories in a JavaScript object; no article pages | Readers could not open or share a story | MySQL articles + translations, localized article routes, category pages, search |
| Every card headline linked to `#gridSection` | The main reading action did nothing | Real article routes and related reporting |
| Secure tip line advertised `+1 (555) 019-2831` | A fictional/reserved number presented as a confidential channel is dangerous | Tip form stored in the protected inbox; no invented number; Settings accepts a verified Signal number only when the owner supplies one |
| No working contact, newsletter, tip, search or live-stream function | The site looked interactive but had no actions | Validated contact/tip/newsletter forms, search, live URL setting, RSS |
| "Verified news" claim with no verification workflow | Trust claim unsupported by the product | Draft → published workflow, desk bylines, corrections/AI policy pages, audit trail |
| All stories shared one date and no bylines | No sense of freshness or accountability | Per-story publication timestamps, bylines, read time, categories |
| No About, privacy, terms or editorial policy | No ownership, data or corrections information | Full policy pages, including the updated privacy disclosures |
| Fictional demonstration stories indistinguishable from reporting | Misleading readers and search engines | `isDemo` flag, visible banner, sitemap exclusion, `noindex`, RSS label, quotation removal, desk bylines |

## 2. Original security and operations defects

| Finding | Risk | Current resolution |
| --- | --- | --- |
| No server, login, roles or admin | Anyone with the file could change anything | Express + tRPC, Manus OAuth, server-side role procedures, protected `/admin` |
| No audit logging | No way to investigate a bad edit or intrusion | Append-only `audit_logs` with actor, action, entity, keyed IP hash, truncated user agent and metadata; hashes are not exposed to admins |
| No rate limits | Spam, brute force and AI cost abuse | API-wide, OAuth, view, AI, newsletter, contact, upload and storage limits; persistent global AI budget |
| Meta CSP with `'unsafe-inline'` scripts; no header protections | Weak XSS/clickjacking posture | Helmet, strict production CSP with `script-src 'self'` and no inline scripts, HSTS, nosniff, frame-ancestors, Permissions-Policy |
| `innerHTML` card rendering | Stored-XSS path once content is editable | React escaping; DOMPurify + marked for article HTML; URL scheme validation |
| No input validation | Malformed or hostile form data | Zod validation on every tRPC input; length and enum limits |
| No upload checks | Malicious file upload | 5 MB cap, JPEG/PNG/WebP allowlist, magic-byte check, random storage key, private/public separation |
| No backups or migrations | Data loss during updates | Checked-in Drizzle migrations, backup and rollback procedure |
| No 404 status | Search engines index empty pages | Real HTTP 404 with a designed page; no soft 404 |
| Insecure first-user admin bootstrap (found during the rebuild) | The first public visitor could become owner | Removed; explicit `OWNER_OPEN_ID` identity plus current-state `ADMIN_EMAILS`/`EDITOR_EMAILS` allowlists |
| Reversible Base64 "IP hash" | Raw addresses were recoverable | HMAC-SHA256 keyed fingerprint, truncated, rotating daily for views; raw IP columns dropped |
| One-year session with Bearer tokens | Stolen tokens stayed valid and were readable by scripts | HttpOnly/SameSite cookie only, 12 h absolute / 4 h idle, server-side session registry, immediate revocation |
| Admin role could not be revoked quickly | A removed administrator kept access | Roles and allowlists checked on every request; sessions revocable; demotion effective immediately |
| No CSRF protection | Cross-site state changes | Origin/Referer allowlist on every unsafe API request, plus SameSite=Lax |
| Newsletter accepted any address | Anyone could subscribe another person | Double opt-in with hashed, expiring tokens and signed unsubscribe links |
| Unbounded view rows and inflatable most-read | Storage growth and ranking manipulation | Unique per visitor/day, `INSERT IGNORE`, 90-day retention, rate limit |
| No revision history | Bad edits were unrecoverable | Revision snapshot on every update; restore always creates a draft |
| Slug changes broke links | Shared URLs 404'd | Durable `article_slug_redirects` with 301 responses |
| Host-header-derived canonical URLs | Search engines could index an attacker domain | `PUBLIC_SITE_URL` required in production; Host never used for canonical, sitemap or RSS |
| No per-language URLs | Translations were not independently crawlable | `/en/`, `/ps/`, `/fa/` with localized slugs, hreflang, sitemaps, RSS and OG |
| Locale stored only in `sessionStorage` | New tabs lost the language; crawlers saw one page | URL-driven locale; language switch preserves the current path |
| No real privacy disclosure for views/AI | Readers could not make an informed choice | Privacy page documents HMAC identifiers, retention, cookies, newsletter and AI provider |

## 3. Hardening-pass defects caught and fixed

1. **Session verification used an empty audience.** `MANUS_PROJECT_ID` is
   optional, but the SDK compared the token audience to `""`, so every login
   failed verification. Fixed with `sessionAppId()` returning the configured
   project id or the stable fallback `buddhanews`.
2. **Expired session rows were accepted.** The JWT signature was checked but the
   row's `expiresAt` was not. Fixed in the SDK and covered by a test.
3. **OAuth state cookie was unusable over HTTP and readable by scripts.** The
   client set `__Host-oauth_state` with `SameSite=None; Secure`, which browsers
   reject on HTTP and which was not HttpOnly. Replaced with a server-issued
   `bn_oauth_state` cookie (`HttpOnly`, `SameSite=Lax`, Secure on HTTPS) and a
   timing-safe nonce check.
4. **The server bundle had no stable entry point.** esbuild emitted
   `dist/index.js` only by accident of naming; `pnpm start` and the Docker CMD
   now work because the build sets `--entry-names='[name]'`.
5. **Oversize bodies produced an HTML stack page.** Added explicit `413` and
   `400` JSON handling.
6. **Admin list APIs leaked secrets.** Subscriber token hashes, IP hashes,
   audit user agents and email bodies were returned to the browser. Projections
   now omit them; the UI was updated.
7. **RSS and sitemaps presented demo content as reporting.** Demo rows are
   excluded from sitemaps, labelled `[Demonstration]` in RSS, and marked
   `noindex` on article pages.
8. **AI placeholder referred to a fictional summit.** Replaced with a neutral
   question in all three languages.
9. **Docker migration default was ambiguous.** The entrypoint only migrates when
   `RUN_MIGRATIONS=1`; the README now says so explicitly.

## 4. Verification performed

- `pnpm test` — **59 passed / 0 failed** across 4 test files.
- `pnpm typecheck` — clean.
- `pnpm build` — client and server bundles succeed; `dist/index.js` and
  `dist/migrate.js` exist.
- Production-mode smoke test on port 3100 with `NODE_ENV=production` and
  `PUBLIC_SITE_URL=https://news.example.com`:
  - `/` → `302 /en/`; `/en/`, `/ps/`, `/fa/` return `200` with correct
    `lang`/`dir`;
  - localized article pages return `200` with canonical, hreflang and demo
    `noindex`;
  - missing article and unknown locale return real `404`;
  - sitemap index, per-language sitemaps and aliases return `200`; RSS is
    labelled; robots points at the trusted origin;
  - private storage returns `401` without a session; public keys return `404`
    when the storage provider is absent (fail closed);
  - CSRF missing/foreign Origin returns `403`; oversize body returns `413`;
  - newsletter subscribe → confirm → unsubscribe → resubscribe works; token
    reuse and tampering are rejected;
  - contact and newsletter limits return `429` at the documented thresholds;
  - Admin/Editor/reader RBAC and immediate role demotion verified.
- Legacy migration test: a database built from `0000` + `0001` with articles,
  translations, duplicate views, raw IP rows and subscribers was upgraded with
  `0002` + `0003`. Duplicate views were reduced, raw IP columns removed,
  user agents truncated, confirmed subscribers backfilled, and localized slugs
  created. Details and rollback: [MIGRATION_AND_ROLLBACK.md](MIGRATION_AND_ROLLBACK.md).

## 5. Residual risks and limits

- **Single-container rate limiter.** Buckets are in process memory; multiple
  instances each have their own counters. The persistent AI ledger still caps
  total spend, but use a shared store (Redis) before horizontal scaling.
- **Manus OAuth dependency.** Self-hosting requires a compatible OAuth provider
  or a replacement sign-in implementation.
- **Email delivery requires configuration.** Messages are queued in
  `email_outbox` until `EMAIL_WEBHOOK_URL` or an outbox worker is provided.
- **Storage requires credentials.** Without `MANUS_API_URL`/`MANUS_API_KEY`,
  uploads fail closed.
- **Docker was not built here.** No container runtime was available in the
  hardening environment; the Dockerfile was reviewed and its paths checked, but
  `docker build` is an operator step.
- **AI output can be wrong.** Every AI action is draft-only; a person must
  review names, numbers, quotes and translations.
- **Demo content remains demo content.** Replace it before a real launch; the
  label and `noindex` reduce harm but do not make it reporting.
