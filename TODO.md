# Buddha News — Delivery Checklist

Status at the hardening delivery (22 November 2026). Detailed evidence is in
[DELIVERY_REPORT.md](DELIVERY_REPORT.md).

## 1. Content integrity

- [x] Demo stories carry `isDemo`, a visible banner, `noindex`, sitemap exclusion
      and an RSS `[Demonstration]` label.
- [x] Fabricated quotations removed from seeded content; bylines are desk names.
- [x] `pnpm db:label-demo` upgrades an existing demo database.
- [x] AI question placeholder no longer refers to a fictional summit.

## 2. Privacy

- [x] Reversible Base64 IP encoding removed.
- [x] HMAC-SHA256 identifiers with a server-side secret; raw IP columns dropped.
- [x] Daily-rotating visitor hash; unique `(article, visitor, day)` view rows.
- [x] IP hashes, token hashes and user agents removed from admin API responses.
- [x] Privacy page documents identifiers, retention, cookies, newsletter and AI.

## 3. Access control and authentication

- [x] Owner identity plus Admin/Editor/User roles; owner-only role changes.
- [x] Current-state `ADMIN_EMAILS`/`EDITOR_EMAILS`; immediate demotion.
- [x] HttpOnly/SameSite=Lax/Secure-on-HTTPS cookie only; no Bearer or storage.
- [x] 12 h absolute / 4 h idle sessions, server-side revocation on logout.
- [x] OAuth state issued by the server with an HttpOnly nonce and redirect check.
- [x] CSRF Origin/Referer check on every unsafe API request.
- [x] Admin and Editor tiers with publish/delete/settings/subscriber separation.

## 4. API, rate limits and spend

- [x] 256 KB default JSON limit; 8 MB only on media upload; 413/400 handlers.
- [x] Global and endpoint-specific limits before expensive work.
- [x] Persistent global/per-IP/per-user AI budget in `ai_usage`.

## 5. Storage and uploads

- [x] Public/private prefixes; private keys require session and ownership/admin.
- [x] Short-lived signed URLs; private responses are `no-store`.
- [x] JPEG/PNG/WebP magic-byte validation, 5 MB cap, sanitized filenames.

## 6. Newsletter and views

- [x] Double opt-in with hashed, 48-hour confirmation tokens.
- [x] Signed, single-purpose unsubscribe links; tampering rejected.
- [x] Correct resubscription flow; confirmed subscribers preserved by migration.
- [x] View dedupe, rate limit, retention and most-read protection.

## 7. Editorial workflow

- [x] Revision snapshot on every update; restore always creates a draft.
- [x] Original publication date preserved on unpublish/republish.
- [x] Durable slug redirects with 301 responses.
- [x] Editor autosave, recovery banner and unsaved-changes warning.
- [x] Role-based publish/delete; soft delete with admin restore.

## 8. Database and migrations

- [x] Additive `0002_security_hardening.sql` with privacy cleanup.
- [x] `0003_backfill_translation_slugs.sql` for legacy localized slugs.
- [x] Indexes for sessions, views, audit, subscribers, media, articles.
- [x] Legacy upgrade tested from `0000` + `0001` with real rows.
- [x] Backup, migration, verification and rollback guide.

## 9. Multilingual and SEO

- [x] `/en/`, `/ps/`, `/fa/` URLs with correct `lang`/`dir`.
- [x] Localized slugs, canonical, hreflang and `x-default`.
- [x] Per-language sitemaps, aliases, RSS and OG metadata.
- [x] `PUBLIC_SITE_URL` required in production; no Host fallback.
- [x] Real 404/503 status; no soft 404; demo `noindex` preserved.
- [x] Honest JSON-LD; desk bylines as organizations.

## 10. Frontend and content security

- [x] Self-hosted fonts; no Google Fonts request.
- [x] External theme bootstrap; `script-src 'self'`, no inline scripts.
- [x] Restricted CSP, Permissions-Policy, HSTS, nosniff, frame-ancestors.
- [x] DOMPurify article rendering and safe image URL validation.
- [x] Error boundary without stack traces; loading/error states retained.
- [x] Responsive, dark/light and RTL layouts retained.

## 11. Packaging and operations

- [x] Multi-stage Dockerfile, non-root uid 10001, health check, signal-safe entrypoint.
- [x] `.dockerignore` excludes secrets, node_modules, dist, tests, docs, backups.
- [x] Unused AWS SDK dependencies removed.
- [x] `pnpm test` 59 passed; `pnpm typecheck` and `pnpm build` pass.
- [x] Production smoke test on a seeded database.
- [ ] Docker image built in an environment with a container runtime (not
      available here; see delivery report).
- [ ] Real mail provider and storage credentials configured by the operator.

## v2 hardening pass (see CHANGES_V2.md)
- [x] Items 1-14 implemented and verified (typecheck, 116 tests, build, legacy-data migration, browser smoke test).
- [ ] Owner: Turnstile keys, mail webhook/SMTP credentials, Admin > Settings values, migrations 0004/0005, optional Redis (see CHANGES_V2.md, part 2).
- [ ] Later release: drop the legacy `articles.tags` CSV column once 0004 has been in production without rollback.

## Homepage refinement (current pass)
- [x] Refine the homepage lead story, globe, article grids, and section hierarchy within the existing editorial design system; preserve routes, content, behavior, and loading, empty, and error states. The ticker is intentionally static and horizontally scrollable rather than continuously animated.
- [x] Support English, Pashto, and Dari with correct language attributes, LTR and RTL layout, and direction-aware controls.
- [x] Provide responsive layouts for 375px mobile, 768px tablet, and 1440px desktop; improve shared navigation, search, and touch controls without changing their interactions or routes.
- [ ] Maintain semantic landmarks, keyboard navigation, visible focus, readable contrast, light/dark themes, and reduced-motion support.
- [x] Verify responsive layouts and accessibility in English and RTL locales using isolated data without modifying live newsroom data.

  Manual follow-up: audit with assistive technology and the browser's reduced-motion preference; review the axe checks marked incomplete (`aria-prohibited-attr` and `color-contrast`). Automated checks are not a certification of accessibility.
