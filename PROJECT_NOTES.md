# Buddha News — architecture notes

## Stack and commands

- React 19 + Vite 7 + Tailwind 4 + wouter + Framer Motion + Three.js.
- Express 4 + tRPC 11 + Drizzle ORM + MySQL/MariaDB.
- `pnpm dev` on port 3000; `pnpm build`; `pnpm start`; `pnpm typecheck`;
  `pnpm test`; `pnpm db:migrate`; `pnpm db:seed`; `pnpm db:label-demo`;
  `pnpm db:cleanup`.
- `dist/index.js` is the production server bundle; `dist/public/` is the client
  build; `dist/migrate.js` applies migrations in a container.

## Data model

`users`, `sessions`, `articles`, `article_translations`,
`article_slug_redirects`, `article_revisions`, `article_views`, `audit_logs`,
`media_assets`, `newsletter_subscribers`, `contact_messages`, `site_settings`,
`ai_usage`, `email_outbox`.

The seed creates 14 fictional stories with EN/PS/FA translations. `server/seed.ts`
is import-safe; the CLI lives in `server/seed-cli.ts` (a CLI guard bundled into
`dist/index.js` previously called `process.exit(0)`). Demo rows are marked
`isDemo` and are excluded from sitemaps and indexed pages.

## Auth and security

- Manus OAuth; the server issues the state nonce in an HttpOnly cookie.
- Owner identity (`OWNER_OPEN_ID`) plus Admin/Editor/User roles.
  `ADMIN_EMAILS`/`EDITOR_EMAILS` are evaluated on every request; only the owner
  can change roles.
- `adminProcedure`, `editorProcedure` and `ownerProcedure` guard tRPC routes.
- Sessions are cookie-only JWTs with a server-side `sessions` row: 12 h absolute,
  4 h idle, revocable on logout.
- CSRF: Origin/Referer allowlist for all unsafe API methods.
- Helmet production CSP with `script-src 'self'`; the theme bootstrap is an
  external file (`client/public/theme-init.js`), not an inline script.
- DOMPurify + marked for article bodies; upload MIME/magic-byte validation.
- HMAC identifiers for views, audit and newsletter; no raw IP columns.
- In-memory limits: API 300/min, views 180/h, contact 4/h, newsletter 6/h,
  public AI 20/h, brief 12/h, editor AI 40/h, upload 30/h.
- Persistent AI ledger: 500 calls / 1.5M tokens per day globally, 60 calls/IP/day,
  400 calls/user/day.

## SEO

`server/seo.ts` injects title/description/OG/Twitter/canonical/hreflang/JSON-LD.
It parses `req.originalUrl` because `req.path` is `/` inside the Express wildcard
fallback. `PUBLIC_SITE_URL` is mandatory in production for absolute canonical,
sitemap and RSS URLs; the Host header is never used. Routes include the sitemap
index, per-language sitemaps and aliases, per-language RSS, robots, and real
404/503 responses. Localized article slugs live in `article_translations.slug`;
old slugs 301 through `article_slug_redirects`.

## Frontend

- Design tokens and prose styles in `client/src/index.css`.
- Public pages under `client/src/pages`; admin pages lazy-loaded in `App.tsx`.
- Globe is a lazy Three.js chunk in `client/src/components/three/GlobeScene.tsx`.
- `ArticleBody` renders sanitized Markdown; do not replace it with a heavy
  Streamdown/Mermaid renderer for article pages.
- Locale is URL-driven in `client/src/contexts/I18nContext.tsx`; switching
  language preserves the current path and does not depend on localStorage.
- Fonts are self-hosted under `client/public/fonts`.

## Assets

Managed images are referenced through `/manus-storage/...`; the server checks
authorization for private keys and redirects to a short-lived signed URL. Seed
image keys are in `server/seed.ts`. Demo images are AI-generated and should be
replaced before launch.

## Release package

`release/buddhanews-hardened.zip` contains source, migrations, tests and docs,
excluding `node_modules`, `.env`, `dist`, backups and local artifacts. Do not
commit secrets into it.
