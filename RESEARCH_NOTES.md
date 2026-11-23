# Research and audit notes

## Manus custom domain / publishing (checked 2026-11-13)

- https://manus.im/docs/website-builder/custom-domains
  - Manus publishes to a domain or subdomain the owner controls; Manus supplies DNS records (A or CNAME); automatic SSL/HTTPS after connection.
- https://manus.im/docs/website-builder/publishing
  - Publish provisions cloud infrastructure, builds the app, deploys it, and configures DNS for a custom domain.
  - Domains can be searched/purchased inside Manus; automatic SSL.
  - Hosting modes: Autoscale (Cloud Run, scale-to-zero) and Reserved (always running, no cold starts).
- https://help.manus.im/en/articles/11711203-how-can-i-connect-manage-the-website-created-by-manus-to-my-custom-domain
  - Comprehensive custom-domain support is currently for paid users.
  - Paid users can modify subdomains; can buy a new domain (non-refundable) or connect an existing GoDaddy/Namecheap domain.
  - `www` may need a separate DNS record; remove conflicting A record; SSL may need disconnect/reconnect.
  - Domain transfer out: Settings → Data controls → Manage → domain → Transfer out; get authorization code; preserve nameservers/DNS.

## Original uploaded file: `buddha_news_interactive_multilingual_preview(1).html` (35,705 bytes)

Concrete findings:
1. Fake secure tip line: `Signal / WhatsApp: +1 (555) 019-2831` in all three languages. 555-0199 is a fictional/reserved pattern; publishing it as a secure channel is unsafe.
2. Static single-file preview only; no server, database, CMS, authentication, article pages, admin, backups or audit trail.
3. All content hardcoded in a JavaScript object (`ARTICLES`, 8 placeholder cards); each card headline links to `#gridSection`, not a story page.
4. No real forms: no contact, newsletter, tip submission, search, or live stream. Live panel is a static placeholder image/play button.
5. `innerHTML` builds cards from title/category strings; safe while hardcoded, but a stored-XSS path if content ever becomes editable.
6. Meta CSP: `script-src 'self' 'unsafe-inline'`; no header-level HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors/clickjacking protection.
7. No rate limiting, CSRF/origin checks, input validation, upload controls, password/session security or audit logging.
8. Language choice stored in `sessionStorage` only; resets on new tab/session. No language in URL, no server-rendered metadata, no hreflang/canonical, no per-language SEO.
9. Theme toggle not persisted; reload resets to OS preference. No reduced-motion handling for pulse/smooth scroll.
10. Category filtering bug: when a subcategory is selected, filter is `art.sub === selectedFilter.s || art.cat === selectedFilter.c`, so every story in the parent category also matches; subcategory filtering is effectively broken.
11. `aria-current` set to string `"true"`/`"false"` rather than a valid token such as `"page"`.
12. Inline SVG placeholders have no accessible image name/alt; cards use color blocks with text instead of editorial images.
13. No Open Graph/Twitter cards, JSON-LD, sitemap, robots, RSS, canonical URLs or 404 page.
14. Logo is a fixed 156×105 text block; no responsive brand mark.
15. Fonts are Merriweather/Roboto/Noto Naskh Arabic; no modern display/UI pairing and no variable-font performance strategy.
16. No animations beyond a pulse badge and smooth scroll; no 3D, no editorial motion system.
17. No privacy/terms/editorial policy/corrections pages; no ownership or AI disclosure.
18. No monitoring, error handling, backups, update process or deployment documentation.

## New site fixes mapped

- Real Express + tRPC + MySQL/Drizzle backend, migrations, idempotent seed, article/translation tables.
- Manus OAuth admin with role checks; no first-visitor auto-admin (removed insecure bootstrap); `ADMIN_EMAILS` allow-list; owner openId promotion.
- Audit log for sign-in, article, media, settings, messages, AI actions; IP + user agent; append-only.
- Helmet CSP (hash for inline theme script), HSTS, nosniff, referrer policy, permissions policy, frame-ancestors self, origin checks, API rate limits, login/contact/newsletter limits.
- DOMPurify + marked sanitized article rendering; 5 MB upload cap + MIME/magic-byte checks.
- Trilingual UI dictionary + RTL (`Vazirmatn`), per-locale translations, fallback notice, localized dates/numbers where Intl supports them.
- Modern design: Fraunces/Manrope/Vazirmatn, paper/ink/teal/saffron, dark mode persisted, reduced-motion support.
- Three.js globe hero (lazy-loaded), marquee ticker, card reveals, reading progress, AI assistant.
- SEO: server-rendered title/description/OG/canonical when `PUBLIC_SITE_URL` set, JSON-LD NewsArticle, sitemap, robots, RSS, 404 status.
- Real article/category/search pages, share buttons, newsletter/contact/tip-line forms.
- Admin CMS: dashboard analytics, story editor with trilingual tabs, AI headline/summary/SEO/tags/translation, media library, inbox, subscribers CSV, settings, audit log.
- Domain/publishing: Manus custom domain flow documented; free plan caveat (paid for custom domains).
