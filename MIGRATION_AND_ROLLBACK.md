# Migration and Rollback Guide

This guide covers upgrading an existing Buddha News database to the hardened
schema (`0002` and `0003`) and rolling back safely if the release must be
reverted. It was exercised against MariaDB 10.11 with a database created from
migrations `0000` + `0001` and populated with articles, translations, duplicate
views, raw-IP audit/contact rows, subscribers and media before applying the new
migrations.

## 1. What the new migrations change

### `0002_security_hardening.sql`

The migration is additive except for deliberate privacy cleanup. It is written
as Drizzle breakpoint SQL and runs statement by statement.

| Area | Change |
| --- | --- |
| Roles | `users.role` gains `editor`; adds `roleSource` and `roleUpdatedAt`; index on `email` |
| Sessions | New `sessions` table (id, user, openId, hashed IP, truncated UA, timestamps, revocation) with user and expiry indexes |
| Articles | `isDemo` flag, `deletedAt` soft delete, indexes on `views` and `deletedAt` |
| Translations | `slug` column; English rows backfilled from `articles.slug`; unique `(locale, slug)` index |
| Redirects | New `article_slug_redirects` table with unique `(locale, oldSlug)` |
| Revisions | New `article_revisions` table with article/time index |
| Views | Adds `visitorHash` and `viewedDay`; backfills from `createdAt`; de-duplicates existing rows; drops raw `ipHash`; adds unique `(articleId, visitorHash, viewedDay)` and `(articleId, viewedDay)` |
| Audit | Adds keyed `ipHash`; **drops raw `ip`**; truncates `userAgent` to 300; index on `actorId` |
| Media | `visibility` enum (`public`/`private`), index on `storageKey` |
| Newsletter | Status gains `pending`; adds confirmation/unsubscribe token hashes, expiry, confirmed/unsubscribed timestamps, keyed `ipHash`, `updatedAt`; existing `subscribed` rows get `confirmedAt = createdAt`; status index |
| Contact | Adds keyed `ipHash`; **drops raw `ip`**; status/time index |
| AI | New `ai_usage` ledger with unique `(day, scope, scopeKey)` |
| Mail | New `email_outbox` with status/time index |

Existing rows are preserved. The only destructive operations are the two raw
IP columns, duplicate view rows, and over-long user-agent strings; those are
intentional privacy/data-minimisation changes and cannot be undone without the
pre-migration backup.

### `0003_backfill_translation_slugs.sql`

Older translations have no localized slug, which would make every language
resolve to the English URL. This migration sets a missing/empty translation
slug to `<english-slug>-<locale>` (for example `legacy-story-fa`), truncated to
180 characters. It only touches `NULL` or empty slugs and is idempotent.
Editors can rename the slug later; the normal update path records a redirect.

## 2. Before you migrate

1. **Freeze writes.** Put the site in maintenance mode or stop the app so no
   new rows arrive during the backup.
2. **Record the current version.**

   ```bash
   mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" \
     -e "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;"
   ```

3. **Take a full logical backup.** Use a dedicated backup account with
   `SELECT`, `SHOW VIEW`, `TRIGGER`, `LOCK TABLES` (and `RELOAD` if available).
   `--single-transaction` gives a consistent InnoDB snapshot without locking
   the whole database; `--routines --triggers` preserve objects.

   ```bash
   export DB_HOST=127.0.0.1 DB_USER=bn DB_NAME=buddhanews
   mkdir -p backups
   mysqldump --single-transaction --quick --routines --triggers \
     --default-character-set=utf8mb4 \
     -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" \
     | gzip > "backups/buddhanews-pre-0002-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
   ```

   For a large database, add `--hex-blob` and consider a physical backup
   (Percona XtraBackup / MariaBackup) instead.

4. **Verify the backup is readable and complete.** Do not skip this step.

   ```bash
   gzip -t backups/buddhanews-pre-0002-*.sql.gz
   gzip -dc backups/buddhanews-pre-0002-*.sql.gz | tail -5
   # Restore into a scratch database and count the important tables.
   mysql -h "$DB_HOST" -u "$DB_USER" -p -e "CREATE DATABASE buddhanews_restore_test"
   gzip -dc backups/buddhanews-pre-0002-*.sql.gz \
     | mysql -h "$DB_HOST" -u "$DB_USER" -p buddhanews_restore_test
   mysql -h "$DB_HOST" -u "$DB_USER" -p buddhanews_restore_test -e "
     SELECT 'articles', COUNT(*) FROM articles
     UNION ALL SELECT 'translations', COUNT(*) FROM article_translations
     UNION ALL SELECT 'views', COUNT(*) FROM article_views
     UNION ALL SELECT 'subscribers', COUNT(*) FROM newsletter_subscribers;"
   ```

5. **Check disk and lock headroom.** The migration creates indexes and copies
   tables; allow at least the size of the largest table in free space. Run it in
   a maintenance window, not at peak traffic.
6. **Confirm the application build matches the schema.** Deploy the server code
   and migrations together. An old server against the new schema will not know
   about `sessions`, soft delete, or the new role.

## 3. Apply the migration

Preferred, from the release artifact:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate          # drizzle-kit migrate, reads DATABASE_URL
# or, from the built server:
pnpm build && pnpm db:migrate:prod
```

In Docker, set `RUN_MIGRATIONS=1` on the container; the entrypoint runs
`node dist/migrate.js` before `node dist/index.js`. Do not run two migration
jobs concurrently.

`pnpm db:push` is a development convenience and must not be used against
production; it can generate destructive diffs. Use the checked-in migrations.

## 4. Post-migration verification

Run these checks before reopening traffic. Replace the database name as needed.

```sql
-- Migration journal should end at 0003.
SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;

-- Raw IP columns must be gone.
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('ip')
  AND TABLE_NAME IN ('audit_logs','contact_messages','article_views');
-- expected: 0 rows

-- Duplicate views must be gone and the unique index present.
SELECT articleId, visitorHash, viewedDay, COUNT(*) AS n
FROM article_views
GROUP BY articleId, visitorHash, viewedDay
HAVING n > 1;
-- expected: 0 rows

SHOW INDEX FROM article_views WHERE Key_name = 'article_views_dedupe_unique';

-- Every translation should now have a slug.
SELECT COUNT(*) AS missing_slugs FROM article_translations
WHERE slug IS NULL OR slug = '';
-- expected: 0

-- Existing confirmed subscribers stay subscribed.
SELECT status, COUNT(*) FROM newsletter_subscribers GROUP BY status;

-- New tables exist.
SHOW TABLES LIKE 'sessions';
SHOW TABLES LIKE 'article_revisions';
SHOW TABLES LIKE 'article_slug_redirects';
SHOW TABLES LIKE 'ai_usage';
SHOW TABLES LIKE 'email_outbox';
```

Then check the application:

```bash
curl -fsS https://your-site.example/api/health
# {"status":"ok","database":"up",...}

curl -sI https://your-site.example/en/ | head -1          # 200
curl -sI https://your-site.example/en/no-such-story | head -1  # 404
curl -sI https://your-site.example/sitemap.xml | head -1  # 200
```

Sign in as an admin, open a story, save a draft, publish it, rename its slug and
confirm the old URL returns `301`; then delete it (soft delete) and restore the
revision as a draft. Confirm an editor cannot publish or open subscribers.
Confirm the newsletter confirmation and unsubscribe links work end to end.

## 5. Rollback

### Preferred: restore the pre-migration backup

Because `0002` drops raw IP columns and de-duplicates views, a schema-only
"down" migration cannot restore the lost values. The supported rollback is a
restore of the backup taken in section 2.

1. Stop the application (and any outbox worker) so nothing writes during the
   restore.
2. Take a safety snapshot of the current, failed state for investigation:

   ```bash
   mysqldump --single-transaction --quick --routines --triggers \
     -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" \
     | gzip > "backups/buddhanews-failed-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
   ```

3. Restore into a **new** database, verify it, then switch the application's
   `DATABASE_URL` to it. This avoids destroying the failed state and makes the
   cutover reversible.

   ```bash
   mysql -h "$DB_HOST" -u "$DB_USER" -p -e "CREATE DATABASE buddhanews_rollback"
   gzip -dc backups/buddhanews-pre-0002-*.sql.gz \
     | mysql -h "$DB_HOST" -u "$DB_USER" -p buddhanews_rollback
   mysql -h "$DB_HOST" -u "$DB_USER" -p buddhanews_rollback -e "
     SELECT COUNT(*) FROM articles; SELECT COUNT(*) FROM newsletter_subscribers;"
   ```

4. Deploy the previous application build (the one that matches the old schema),
   point `DATABASE_URL` at `buddhanews_rollback`, and restart.
5. Keep the failed database and the backup until the incident review is closed.

### Emergency schema-only reverse (data loss is permanent)

Use this only when a backup restore is impossible and you accept that raw IPs,
duplicate view rows, and over-long user agents cannot be recovered. It reverses
the structural changes; it does **not** recreate the dropped columns' data.

```sql
-- Run with the application stopped, inside a transaction where supported.
-- MariaDB/MySQL DDL auto-commits, so this is not atomic.
DROP TABLE IF EXISTS email_outbox;
DROP TABLE IF EXISTS ai_usage;
DROP TABLE IF EXISTS article_revisions;
DROP TABLE IF EXISTS article_slug_redirects;
DROP TABLE IF EXISTS sessions;

ALTER TABLE newsletter_subscribers
  DROP INDEX newsletter_status_idx,
  DROP COLUMN updatedAt,
  DROP COLUMN ipHash,
  DROP COLUMN unsubscribedAt,
  DROP COLUMN confirmedAt,
  DROP COLUMN unsubscribeTokenHash,
  DROP COLUMN confirmExpiresAt,
  DROP COLUMN confirmTokenHash,
  MODIFY COLUMN status ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed';

ALTER TABLE media_assets
  DROP INDEX media_storage_key_idx,
  DROP COLUMN visibility;

ALTER TABLE contact_messages
  DROP INDEX contact_status_idx,
  DROP COLUMN ipHash,
  ADD COLUMN ip VARCHAR(64);

ALTER TABLE audit_logs
  DROP INDEX audit_logs_actor_idx,
  MODIFY COLUMN userAgent VARCHAR(512),
  DROP COLUMN ipHash,
  ADD COLUMN ip VARCHAR(64);

ALTER TABLE article_views
  DROP INDEX article_views_article_day_idx,
  DROP INDEX article_views_dedupe_unique,
  DROP COLUMN viewedDay,
  DROP COLUMN visitorHash,
  ADD COLUMN ipHash VARCHAR(64);

ALTER TABLE article_translations
  DROP INDEX article_locale_slug_unique,
  DROP COLUMN slug;

ALTER TABLE articles
  DROP INDEX articles_deleted_idx,
  DROP INDEX articles_views_idx,
  DROP COLUMN deletedAt,
  DROP COLUMN isDemo;

ALTER TABLE users
  DROP INDEX users_email_idx,
  DROP COLUMN roleUpdatedAt,
  DROP COLUMN roleSource,
  MODIFY COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user';

-- Then remove the 0002/0003 journal rows so the old build does not think they
-- are still applied. Use the exact hashes from your journal, or restore the
-- pre-migration journal from the backup.
-- DELETE FROM __drizzle_migrations WHERE id >= <first_new_migration_id>;
```

After a schema-only reverse, deploy the previous build and test sign-in,
article CRUD, newsletter and sitemap. Prefer restoring the backup.

## 6. Operational notes

- **Backups:** keep at least 7 daily, 4 weekly and 12 monthly copies, encrypted
  at rest, with one copy off-site. Test a restore quarterly.
- **Retention:** `pnpm db:cleanup` deletes views older than 90 days, audit rows
  older than 365 days, pending subscribers older than 14 days, and expired
  sessions. Schedule it daily after the migration. These windows are
  configurable; changing them changes what the privacy page promises.
- **Revisions:** restoring a revision always produces a draft; it never
  republishes silently. Revisions are retained when an article is soft-deleted.
- **Slug redirects:** changing a slug inserts a durable redirect. Do not delete
  `article_slug_redirects` rows unless you intend to break old links.
- **Demo data:** if the old database was seeded with demo stories, run
  `pnpm db:label-demo` after the migration. It sets `isDemo`, replaces
  fabricated quotations, and normalizes desk bylines. Sitemaps then exclude
  those rows and article pages render the demonstration banner.
- **Rollback of code only:** if the schema migration succeeded but the new
  application build is faulty, you can usually redeploy the previous build
  without restoring the database, provided that build ignores the new nullable
  columns. Test this in staging first; the old build does not know about soft
  delete or the `sessions` table, so it may show deleted rows or fail auth.

## 7. Migrations 0004 and 0005 (relations, categories, tags, mail retry)

**Back up first** (`mysqldump --single-transaction`). Then apply as usual
(`RUN_MIGRATIONS=1` on container start, `pnpm db:migrate`, or
`node dist/migrate.js`). The migrations were tested on a database filled with
legacy data (orphan rows, CSV tags with duplicates and blanks, an unknown
category, a dangling author id).

### `0004_relations_categories_tags.sql`
| Change | Detail |
| --- | --- |
| Orphan clean-up | Rows whose parent no longer exists are deleted (translations, redirects, views, revisions) or set to NULL (author/editor/uploader/actor ids) so the foreign keys can be added. |
| `categories` | Lookup table (`slug` PK, `active`, `sortOrder`) seeded with `afghanistan, world, business, sports, culture, opinion, specials, videos`. Any other value already present in `articles.category` is inserted with `active = 0` so existing stories keep working and show up for review. |
| `tags`, `article_tags` | Tags are normalised: split on commas, trimmed, case-insensitive de-duplication, blanks dropped (up to 50 per story). `article_tags(articleId, tagId, position)` has a composite primary key and keeps the original order. |
| Foreign keys | `articles.category -> categories` RESTRICT. `articles.authorId`, `article_revisions.editorId`, `media_assets.uploadedBy`, `audit_logs.actorId -> users` SET NULL. `article_translations`, `article_slug_redirects`, `article_revisions`, `article_views`, `article_tags -> articles` CASCADE. `sessions.userId -> users` CASCADE. |
| Legacy column | `articles.tags` (CSV) is **kept and still written** by the app, so rolling the application back loses nothing. Remove it in a later release once you are sure. |

### `0005_email_verification_and_outbox_retry.sql`
Adds `users.emailVerified` (nullable: NULL = provider did not say),
`email_outbox.nextAttemptAt` and an index for the delivery worker.

### Before/after checks
```sql
SELECT COUNT(*) FROM articles a LEFT JOIN categories c ON c.slug = a.category WHERE c.slug IS NULL; -- 0
SELECT slug FROM categories WHERE active = 0;       -- legacy categories needing a decision
SELECT COUNT(*) FROM tags; SELECT COUNT(*) FROM article_tags;
```
Review inactive categories: either re-map the stories
(`UPDATE articles SET category = 'world' WHERE category = 'Old-Value';`) or set
`active = 1` and add the category to `shared/news.ts` if you want it in the menu.

### Rolling back 0004/0005 (schema only, data in the new tables is lost)
Preferred: restore the backup. Emergency reverse, with the app stopped:
```sql
ALTER TABLE articles DROP FOREIGN KEY articles_category_fk;
-- drop the remaining FKs named *_fk (see: SHOW CREATE TABLE <table>), then:
DROP TABLE IF EXISTS article_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS categories;
ALTER TABLE users DROP COLUMN emailVerified;
ALTER TABLE email_outbox DROP INDEX email_outbox_next_idx, DROP COLUMN nextAttemptAt;
DELETE FROM __drizzle_migrations ORDER BY id DESC LIMIT 2;  -- forget 0004 and 0005
```
Because the CSV `articles.tags` column was never dropped, the previous release
works again without any data conversion.
