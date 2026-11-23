-- Backfill localized slugs for translations created before slug support.
--
-- Without this, every non-English translation of an older story resolves to the
-- English base slug, producing duplicate URLs for the same article. The suffix
-- is deterministic and URL-safe; editors can rename it later, and the old value
-- is recorded in article_slug_redirects by the normal update path.
UPDATE `article_translations` t
JOIN `articles` a ON a.`id` = t.`articleId`
SET t.`slug` = LEFT(CONCAT(a.`slug`, '-', t.`locale`), 180)
WHERE t.`slug` IS NULL OR t.`slug` = '';
