-- Buddha News — production hardening migration (additive, non-destructive).
--
-- Safety: every statement adds or narrows structure. Existing rows are kept.
-- Raw IP addresses already stored in audit_logs/contact_messages are dropped
-- on purpose (privacy), and article_views rows are de-duplicated before the
-- new unique index is created. See MIGRATION_AND_ROLLBACK.md for the backup
-- and rollback procedure.

-- 1. Roles: add the editor tier and record where a role came from.
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','editor','admin') NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `roleSource` enum('default','env','manual') NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `roleUpdatedAt` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);
--> statement-breakpoint

-- 2. Server-side session registry (revocation, idle expiry).
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`openId` varchar(64) NOT NULL,
	`ipHash` varchar(64),
	`userAgent` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);
--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expiresAt`);
--> statement-breakpoint

-- 3. Articles: demonstration flag, soft delete, ranking indexes.
ALTER TABLE `articles` ADD COLUMN `isDemo` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `articles` ADD COLUMN `deletedAt` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `articles_views_idx` ON `articles` (`views`);
--> statement-breakpoint
CREATE INDEX `articles_deleted_idx` ON `articles` (`deletedAt`);
--> statement-breakpoint

-- 4. Localized slugs. English keeps the canonical slug so old URLs stay valid.
ALTER TABLE `article_translations` ADD COLUMN `slug` varchar(180);
--> statement-breakpoint
UPDATE `article_translations` t
JOIN `articles` a ON a.`id` = t.`articleId`
SET t.`slug` = a.`slug`
WHERE t.`locale` = 'en' AND t.`slug` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `article_locale_slug_unique` ON `article_translations` (`locale`,`slug`);
--> statement-breakpoint

-- 5. Durable redirects for slug changes.
CREATE TABLE `article_slug_redirects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`locale` varchar(8) NOT NULL DEFAULT 'en',
	`oldSlug` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_slug_redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug_redirect_locale_slug_unique` UNIQUE(`locale`,`oldSlug`)
);
--> statement-breakpoint
CREATE INDEX `slug_redirect_article_idx` ON `article_slug_redirects` (`articleId`);
--> statement-breakpoint

-- 6. Revision history.
CREATE TABLE `article_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`editorId` int,
	`editorName` varchar(160),
	`action` varchar(40) NOT NULL,
	`summary` varchar(300),
	`snapshot` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `article_revisions_article_idx` ON `article_revisions` (`articleId`,`createdAt`);
--> statement-breakpoint

-- 7. Privacy-preserving, de-duplicated view rows.
ALTER TABLE `article_views` ADD COLUMN `visitorHash` varchar(64) NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE `article_views` ADD COLUMN `viewedDay` date NOT NULL DEFAULT '1970-01-01';
--> statement-breakpoint
UPDATE `article_views` SET `viewedDay` = DATE(`createdAt`) WHERE `viewedDay` = '1970-01-01';
--> statement-breakpoint
UPDATE `article_views` SET `visitorHash` = LEFT(SHA2(CONCAT('legacy:', COALESCE(`ipHash`, `id`)), 256), 48) WHERE `visitorHash` = 'legacy';
--> statement-breakpoint
DELETE v1 FROM `article_views` v1
JOIN `article_views` v2
  ON v1.`articleId` = v2.`articleId`
 AND v1.`visitorHash` = v2.`visitorHash`
 AND v1.`viewedDay` = v2.`viewedDay`
 AND v1.`id` > v2.`id`;
--> statement-breakpoint
ALTER TABLE `article_views` DROP COLUMN `ipHash`;
--> statement-breakpoint
CREATE UNIQUE INDEX `article_views_dedupe_unique` ON `article_views` (`articleId`,`visitorHash`,`viewedDay`);
--> statement-breakpoint
CREATE INDEX `article_views_article_day_idx` ON `article_views` (`articleId`,`viewedDay`);
--> statement-breakpoint

-- 8. Audit log: replace raw addresses with keyed hashes.
ALTER TABLE `audit_logs` ADD COLUMN `ipHash` varchar(64);
--> statement-breakpoint
ALTER TABLE `audit_logs` DROP COLUMN `ip`;
--> statement-breakpoint
UPDATE `audit_logs` SET `userAgent` = LEFT(`userAgent`, 300) WHERE CHAR_LENGTH(`userAgent`) > 300;
--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `userAgent` varchar(300);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorId`);
--> statement-breakpoint

-- 9. Media visibility.
ALTER TABLE `media_assets` ADD COLUMN `visibility` enum('public','private') NOT NULL DEFAULT 'public';
--> statement-breakpoint
CREATE INDEX `media_storage_key_idx` ON `media_assets` (`storageKey`);
--> statement-breakpoint

-- 10. Newsletter double opt-in. Existing confirmed subscribers stay
--     subscribed (they opted in under the previous policy); new addresses
--     start as `pending` and need the emailed token.
ALTER TABLE `newsletter_subscribers` MODIFY COLUMN `status` enum('pending','subscribed','unsubscribed') NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `confirmTokenHash` varchar(64);
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `confirmExpiresAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `unsubscribeTokenHash` varchar(64);
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `confirmedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `unsubscribedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `ipHash` varchar(64);
--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
UPDATE `newsletter_subscribers` SET `confirmedAt` = `createdAt` WHERE `status` = 'subscribed' AND `confirmedAt` IS NULL;
--> statement-breakpoint
CREATE INDEX `newsletter_status_idx` ON `newsletter_subscribers` (`status`);
--> statement-breakpoint

-- 11. Contact messages: replace the raw address with a keyed hash.
ALTER TABLE `contact_messages` ADD COLUMN `ipHash` varchar(64);
--> statement-breakpoint
ALTER TABLE `contact_messages` DROP COLUMN `ip`;
--> statement-breakpoint
CREATE INDEX `contact_status_idx` ON `contact_messages` (`status`,`createdAt`);
--> statement-breakpoint

-- 12. AI budget ledger.
CREATE TABLE `ai_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` date NOT NULL,
	`scope` varchar(16) NOT NULL,
	`scopeKey` varchar(80) NOT NULL,
	`calls` int NOT NULL DEFAULT 0,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_usage_day_scope_unique` UNIQUE(`day`,`scope`,`scopeKey`)
);
--> statement-breakpoint

-- 13. Transactional mail outbox (no SMTP credentials are bundled).
CREATE TABLE `email_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`subject` varchar(300) NOT NULL,
	`body` text NOT NULL,
	`kind` varchar(40) NOT NULL,
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `email_outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `email_outbox_status_idx` ON `email_outbox` (`status`,`createdAt`);
