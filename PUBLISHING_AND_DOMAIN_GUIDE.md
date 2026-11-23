# Publishing, domain and launch guide

This guide covers the supported Manus hosting path first, then the domain options and the self-hosting escape hatch.

## 1. Publish with Manus (recommended)

Manus publishes the latest saved checkpoint to a secure, scalable HTTPS URL.

1. In the Manus project, open **Preview** and confirm the site works.
2. Choose **Publish** in the Dashboard (or ask Manus to publish this site).
3. Wait for the build and deployment to finish. The first publication is private by default; later publications preserve your visibility choice.
4. Open the published URL and check the home page, an article, `/admin`, `/sitemap.xml`, `/rss.xml` and `/robots.txt`.
5. Set visibility to **Public** when you are ready for readers. The Dashboard provides the visibility control; expanding access requires your confirmation.

**Before publishing**, set `PUBLIC_SITE_URL` in the project environment to the final HTTPS origin (for example `https://www.buddhanews.com`). In production the server refuses to start without it; canonical, sitemap and RSS URLs are built only from this value and never from the request `Host` header, so a proxy or staging host cannot leak into public metadata.

Hosting modes:

- **Autoscale** (default) scales to zero when idle and can cold-start on the first request. It is suitable for a news site with variable traffic.
- **Reserved** keeps an instance running continuously and avoids cold starts. It is a paid/hosting-plan decision; the platform will show the available upgrade path.

## 2. Custom domain: what is possible

Manus supports publishing to a domain or subdomain you control and provisions SSL automatically. According to Manus’s current documentation and help centre:

- **Custom-domain support is a paid-user feature.** Free accounts can publish to a Manus URL but should not assume they can connect an arbitrary domain.
- Paid users can search and **buy a new domain inside Manus**, or connect an existing domain bought at GoDaddy, Namecheap, Cloudflare or another registrar.
- Manus supplies the exact DNS records (usually an A or CNAME record). Add them at the registrar/DNS host. For `www`, Manus may require a separate record; remove a conflicting A record first.
- SSL is provisioned automatically after the DNS is correct. If the `www` certificate fails, disconnect and reconnect the domain and choose “set up both.”
- Domain purchases are generally non-refundable. Check the spelling and the renewal price before paying.

If the builder asks for a paid plan and you do not want to upgrade yet, use the Manus URL and treat the custom domain as a later step. Do not buy a domain expecting the free plan to connect it.

### Buying a domain

Good registrars for a news organisation:

| Registrar | Why consider it | Watch for |
| --- | --- | --- |
| Cloudflare Registrar | At-cost registration/renewal, strong DNS, free proxy/WAF options | Requires Cloudflare DNS; some TLDs unavailable |
| Namecheap | Simple interface, WHOIS privacy, common TLDs | Upsells at checkout; renewal price can rise |
| Porkbun | Competitive pricing, free WHOIS privacy | Fewer local support options |
| GoDaddy | Widely available, easy phone support | Aggressive upsells; check renewal pricing |

A sensible domain strategy:

- Primary: `buddhanews.com` if available, or a close variant you can own long term.
- Alternatives: `buddhanews.news`, `buddhanews.media`, `bmg.news`, `buddhanewsafghanistan.com`.
- Avoid hyphens and numbers unless they are part of the real brand.
- Check trademark conflicts before paying. A domain being available does not mean the name is safe to use.
- Turn on auto-renew, WHOIS privacy and registrar lock. Keep the registrar account secured with a strong unique password and 2FA.
- Keep the domain and the hosting account in the **owner’s** name, not a developer’s. This is the difference between owning the site and renting it.

### Connecting an existing domain (paid Manus path)

1. Buy or log in to the domain at the registrar.
2. In Manus, choose the custom-domain option and enter the exact hostname (`www.example.com` or `example.com`).
3. Copy the DNS records Manus displays. Do not guess them.
4. At the registrar’s DNS panel, add the records. Remove conflicting A/AAAA/CNAME records for the same host.
5. Wait for DNS propagation (often minutes, up to 48 hours).
6. Return to Manus and verify. SSL should provision automatically.
7. Test `https://`, `http://` redirect, `www` and the bare domain.
8. Set `PUBLIC_SITE_URL` to the canonical version you chose, rebuild/redeploy, and resubmit the sitemap.

### If you self-host the domain

If you export the code and deploy to another platform (Render, Railway, Fly.io, a VPS, Vercel for the frontend + a separate API), the domain is connected at that platform instead. The DNS records will be that platform’s records, not Manus’s. The next section explains the code-level work.

## 3. Self-hosting the code

The repository is a standard Node/Express/React application with a Dockerfile. It can run outside Manus, but these Manus-managed capabilities need replacement:

| Capability | What the code uses | Self-host replacement |
| --- | --- | --- |
| Database | Managed MySQL via `DATABASE_URL` | MySQL 8 (PlanetScale, Aiven, Railway, RDS, etc.); run `pnpm db:migrate` |
| Login | Manus OAuth (`MANUS_OAUTH_*`, `MANUS_PROJECT_ID`) | Add an auth provider (Auth.js, Clerk, Supabase Auth) or implement email/password with argon2 + reset flow; update `server/_core/oauth.ts`, `sdk.ts`, and the login page |
| Media | `storagePut()` + `/manus-storage/` | S3, Cloudflare R2, Supabase Storage or similar; replace `server/storage.ts` and the media URL resolver |
| AI | Manus LLM proxy (`MANUS_API_URL`, `MANUS_API_KEY`) | OpenAI/Anthropic/Google API key and a compatible `invokeLLM` adapter |
| Email | `email_outbox` + built-in delivery worker | `EMAIL_WEBHOOK_URL` (+ token) or SMTP (`SMTP_URL` or `SMTP_HOST`/`PORT`/`USER`/`PASS`) and `NEWSLETTER_FROM_EMAIL` |

Docker outline:

```bash
# Build
docker build -t buddha-news .

# Run (the database must already exist and be migrated)
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL='mysql://user:pass@host:3306/news' \
  -e MANUS_JWT_SECRET='...' \
  -e PRIVACY_HASH_SECRET='...' \
  -e PUBLIC_SITE_URL='https://www.example.com' \
  -e ADMIN_EMAILS='owner@example.com' \
  -e EDITOR_EMAILS='editor@example.com' \
  -e MANUS_PROJECT_ID='...' \
  -e MANUS_OAUTH_API_URL='https://api.manus.ai' \
  -e MANUS_OAUTH_PORTAL_URL='https://manus.ai' \
  -e MANUS_API_URL='https://api.manus.ai' \
  -e MANUS_API_KEY='...' \
  -e RUN_MIGRATIONS=1 \
  buddha-news
```

Apply migrations from a machine that can reach the database:

```bash
DATABASE_URL='mysql://...' pnpm db:migrate
DATABASE_URL='mysql://...' pnpm db:seed   # optional demo content
```

Do not run the seed against a live newsroom unless you intend to add the demonstration stories; the seed is idempotent but it will insert missing demo articles.

The Docker container is stateless. Uploaded media and the database must be durable external services. Do not mount a local uploads folder and call it a backup.

## 4. Database backup and restore

Create a compressed backup:

```bash
mysqldump --single-transaction --routines --triggers \
  --set-gtid-purged=OFF \
  -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" \
  | gzip > "buddha-news-$(date +%F-%H%M).sql.gz"
```

Restore into a staging database first:

```bash
gunzip -c buddha-news-YYYY-MM-DD-HHMM.sql.gz \
  | mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME"
```

Keep backups encrypted and outside the application container. Test the restore before relying on it. For managed MySQL, also enable the provider’s automated backups and point-in-time recovery if available.

## 5. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | MySQL connection string |
| `MANUS_JWT_SECRET` | Yes in production | Session signing secret |
| `PRIVACY_HASH_SECRET` | Recommended | Dedicated HMAC key for IP fingerprints and tokens |
| `PUBLIC_SITE_URL` | Yes in production | Trusted HTTPS origin for canonical, sitemap, RSS and OG |
| `MANUS_PROJECT_ID` | On Manus | OAuth application identity; empty falls back to `buddhanews` |
| `MANUS_OAUTH_API_URL` | On Manus | OAuth provider base URL |
| `MANUS_OAUTH_PORTAL_URL` | On Manus | OAuth portal base URL |
| `MANUS_API_URL` / `MANUS_API_KEY` | For AI/media | Manus service API |
| `OWNER_OPEN_ID` | Recommended | Account allowed to change roles (owner identity) |
| `ADMIN_EMAILS` | Recommended | Current-state administrator allowlist |
| `EDITOR_EMAILS` | Optional | Current-state editor allowlist (no publish/delete) |
| `SESSION_TTL_HOURS` / `SESSION_IDLE_HOURS` | Optional | 12 h absolute / 4 h idle |
| `NEWSLETTER_FROM_EMAIL`, `EMAIL_WEBHOOK_URL` | For mail | Sender and delivery webhook |
| `AI_DAILY_CALL_LIMIT` / `AI_DAILY_TOKEN_LIMIT` | Optional | Global AI spend caps |
| `ALLOWED_ORIGINS` | Optional | Extra exact browser origins allowed to POST to the API; leave blank normally |
| `PORT` | Optional | Listener port (default 3000) |
| `NODE_ENV` | Production | Enables production headers/static serving |

Never commit `.env` or paste its contents into a public ticket.

## 6. Launch checklist

### Content

- [ ] Replace the 14 demonstration stories with real reporting.
- [ ] Replace AI illustrations with owned/licensed photography or label generated images.
- [ ] Set `contactEmail` in Admin > Settings (or `CONTACT_EMAIL`) to a real, monitored inbox; the demo address is gone from the defaults but the seed still uses it.
- [ ] Open Admin > Dashboard and clear the Launch checklist (or run `pnpm launch:check`).
- [ ] Add a verified Signal number or leave the field blank.
- [ ] Set a working live-stream URL or leave it blank.
- [ ] Review About, Privacy, Terms and Editorial Policy for your organisation.
- [ ] Add a corrections/contact workflow that a reader can actually use.

### Technical

- [ ] `PUBLIC_SITE_URL` is the final HTTPS origin.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
- [ ] `/api/health` returns 200.
- [ ] Home, article, category, search, contact, tip, privacy and 404 pages load.
- [ ] `/admin` redirects unauthenticated visitors to sign-in; the owner can sign in.
- [ ] A reader account sees “not authorized,” not the dashboard; an editor can draft but cannot publish or open subscribers.
- [ ] Article HTML has a story-specific title and canonical URL.
- [ ] `/sitemap.xml`, `/en/sitemap.xml`, `/en/rss.xml` and `/robots.txt` respond.
- [ ] A missing article returns a real HTTP 404, not a 200 “not found” page.
- [ ] Security headers are present (CSP, HSTS, nosniff, referrer policy).
- [ ] A test contact/tip submission arrives in the inbox; newsletter signup sends a confirmation link and only then appears as subscribed.
- [ ] A private storage key returns 401 without a session; a public image loads.
- [ ] Media upload works and rejects an oversized/wrong-type file.
- [ ] A backup has been taken and restored into staging.

### Search and sharing

- [ ] Submit the sitemap in Google Search Console and Bing Webmaster Tools.
- [ ] Verify the domain property.
- [ ] Test a story link in WhatsApp, X, Facebook, Telegram and email; the preview image/title should be correct.
- [ ] Check mobile at 360 px, 768 px and desktop.
- [ ] Check English LTR and Pashto/Dari RTL.
- [ ] Check reduced-motion mode and keyboard-only navigation.

### Operations

- [ ] Registrar and hosting accounts are in the owner’s name.
- [ ] 2FA is enabled on the registrar, hosting, Manus and database accounts.
- [ ] WHOIS privacy and auto-renew are on.
- [ ] A second administrator is documented (or consciously not added).
- [ ] A monthly backup/update/security-review reminder exists.
- [ ] An incident contact and a rollback plan are written down.

## 7. Costs to plan for

Prices change; verify at purchase. Budget for:

- Domain registration and renewal (typically a modest annual fee; premium names cost much more).
- Manus hosting plan if you need a custom domain, reserved hosting or higher usage.
- Managed MySQL/storage usage if you outgrow the included allowance.
- Email newsletter provider (often free at small list sizes).
- Optional CDN/WAF (Cloudflare has a free tier; paid plans add advanced rules).
- Your time for reporting, editing, moderation and monthly maintenance.

Do not buy “lifetime hosting” or “guaranteed SEO” packages. A news site needs a real owner, a real domain and a maintainable stack — not a one-off reseller.

## 8. What “buying the website” means

You own the source code and the database schema in this repository. The Manus project, the Manus account, the domain registration, the hosting subscription and any third-party API accounts are separate assets. To own the whole package long term:

1. Keep the repository exported to your own GitHub (or a private Git remote) as a backup.
2. Keep the domain in your registrar account.
3. Keep the hosting/database accounts in your name with billing access.
4. Keep a copy of this guide, the environment variable list and a recent database backup offline.
5. Do not let a single developer hold the only administrator account or the only copy of the code.

If you later move to another developer or agency, they should be able to clone the repository, set the environment variables, run the migrations and continue. That is the practical test of ownership.
