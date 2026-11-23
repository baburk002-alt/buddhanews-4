-- Relational integrity for the newsroom schema.
--
--   1. Remove rows that point at parents which no longer exist, so the foreign
--      keys below can be created on real-world (legacy) data.
--   2. Add foreign keys with explicit ON DELETE behaviour.
--   3. Introduce a `categories` lookup and make articles.category reference it.
--   4. Normalise the comma-separated articles.tags text into `tags` and
--      `article_tags`. The legacy articles.tags column is KEPT (and still
--      written by the app) so this migration can be rolled back without data
--      loss; it can be dropped in a later release.
--
-- See MIGRATION_AND_ROLLBACK.md for the rollback recipe.

-- ---------------------------------------------------------------- 1. orphans
DELETE FROM `article_translations` WHERE `articleId` NOT IN (SELECT `id` FROM `articles`);
--> statement-breakpoint
DELETE FROM `article_slug_redirects` WHERE `articleId` NOT IN (SELECT `id` FROM `articles`);
--> statement-breakpoint
DELETE FROM `article_revisions` WHERE `articleId` NOT IN (SELECT `id` FROM `articles`);
--> statement-breakpoint
DELETE FROM `article_views` WHERE `articleId` NOT IN (SELECT `id` FROM `articles`);
--> statement-breakpoint
DELETE FROM `sessions` WHERE `userId` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint
UPDATE `articles` SET `authorId` = NULL WHERE `authorId` IS NOT NULL AND `authorId` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint
UPDATE `article_revisions` SET `editorId` = NULL WHERE `editorId` IS NOT NULL AND `editorId` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint
UPDATE `media_assets` SET `uploadedBy` = NULL WHERE `uploadedBy` IS NOT NULL AND `uploadedBy` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint
UPDATE `audit_logs` SET `actorId` = NULL WHERE `actorId` IS NOT NULL AND `actorId` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint

-- ------------------------------------------------------------ 2. categories
CREATE TABLE `categories` (
`slug` varchar(40) NOT NULL,
`active` boolean NOT NULL DEFAULT true,
`sortOrder` int NOT NULL DEFAULT 0,
`createdAt` timestamp NOT NULL DEFAULT (now()),
CONSTRAINT `categories_slug` PRIMARY KEY(`slug`)
);
--> statement-breakpoint
INSERT INTO `categories` (`slug`, `active`, `sortOrder`) VALUES
('afghanistan', true, 1),
('world', true, 2),
('business', true, 3),
('sports', true, 4),
('culture', true, 5),
('opinion', true, 6),
('specials', true, 7),
('videos', true, 8);
--> statement-breakpoint
-- Values that exist in old data but are not part of the current taxonomy are
-- kept (inactive) instead of being deleted or rewritten, so no story is lost
-- and the foreign key can be created. Editors can re-categorise them; new
-- stories can only use active categories (validated in the API).
INSERT IGNORE INTO `categories` (`slug`, `active`, `sortOrder`)
SELECT DISTINCT `category`, false, 100 FROM `articles` WHERE `category` IS NOT NULL AND `category` <> '';
--> statement-breakpoint

-- ----------------------------------------------------------- 3. tags + join
CREATE TABLE `tags` (
`id` int AUTO_INCREMENT NOT NULL,
`name` varchar(60) NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT (now()),
CONSTRAINT `tags_id` PRIMARY KEY(`id`),
CONSTRAINT `tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `article_tags` (
`articleId` int NOT NULL,
`tagId` int NOT NULL,
`position` int NOT NULL DEFAULT 0,
CONSTRAINT `article_tags_articleId_tagId` PRIMARY KEY(`articleId`, `tagId`)
);
--> statement-breakpoint
CREATE INDEX `article_tags_tag_idx` ON `article_tags` (`tagId`);
--> statement-breakpoint
-- Split "a, b ,c" into rows (up to 50 tags per story). Empty pieces are
-- dropped; names are trimmed and cut to 60 chars; duplicates (case-insensitive)
-- collapse onto one tag row.
INSERT IGNORE INTO `tags` (`name`)
SELECT DISTINCT LEFT(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(a.`tags`, ',', n.`n`), ',', -1)), 60)
FROM `articles` a
JOIN (
SELECT d1.`d` + d2.`d` * 10 + 1 AS `n`
FROM (SELECT 0 AS `d` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
CROSS JOIN (SELECT 0 AS `d` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) d2
) n ON n.`n` <= 1 + LENGTH(a.`tags`) - LENGTH(REPLACE(a.`tags`, ',', ''))
WHERE a.`tags` IS NOT NULL
AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(a.`tags`, ',', n.`n`), ',', -1)) <> '';
--> statement-breakpoint
INSERT IGNORE INTO `article_tags` (`articleId`, `tagId`, `position`)
SELECT a.`id`, t.`id`, MIN(n.`n`)
FROM `articles` a
JOIN (
SELECT d1.`d` + d2.`d` * 10 + 1 AS `n`
FROM (SELECT 0 AS `d` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
CROSS JOIN (SELECT 0 AS `d` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) d2
) n ON n.`n` <= 1 + LENGTH(a.`tags`) - LENGTH(REPLACE(a.`tags`, ',', ''))
JOIN `tags` t ON t.`name` = LEFT(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(a.`tags`, ',', n.`n`), ',', -1)), 60)
WHERE a.`tags` IS NOT NULL
GROUP BY a.`id`, t.`id`;
--> statement-breakpoint

-- ------------------------------------------------------------ 4. foreign keys
CREATE INDEX `articles_author_idx` ON `articles` (`authorId`);
--> statement-breakpoint
CREATE INDEX `article_revisions_editor_idx` ON `article_revisions` (`editorId`);
--> statement-breakpoint
CREATE INDEX `media_uploaded_by_idx` ON `media_assets` (`uploadedBy`);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_category_fk` FOREIGN KEY (`category`) REFERENCES `categories`(`slug`) ON DELETE RESTRICT ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_author_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_translations` ADD CONSTRAINT `article_translations_article_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_slug_redirects` ADD CONSTRAINT `slug_redirects_article_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_revisions` ADD CONSTRAINT `article_revisions_article_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_revisions` ADD CONSTRAINT `article_revisions_editor_fk` FOREIGN KEY (`editorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_views` ADD CONSTRAINT `article_views_article_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_tags` ADD CONSTRAINT `article_tags_article_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `article_tags` ADD CONSTRAINT `article_tags_tag_fk` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_uploader_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
