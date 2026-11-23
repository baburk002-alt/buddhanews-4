CREATE TABLE `article_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`locale` varchar(8) NOT NULL,
	`title` varchar(300) NOT NULL,
	`summary` text,
	`content` longtext,
	`seoTitle` varchar(200),
	`seoDescription` varchar(320),
	`aiSummary` text,
	`aiSummaryAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `article_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `article_locale_unique` UNIQUE(`articleId`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `article_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`locale` varchar(8) NOT NULL DEFAULT 'en',
	`ipHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`category` varchar(40) NOT NULL,
	`subcategory` varchar(60),
	`coverImage` text,
	`coverAlt` text,
	`authorId` int,
	`authorName` varchar(160) NOT NULL DEFAULT 'BMG Newsroom',
	`featured` boolean NOT NULL DEFAULT false,
	`breaking` boolean NOT NULL DEFAULT false,
	`readMinutes` int NOT NULL DEFAULT 4,
	`tags` text,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`views` int NOT NULL DEFAULT 0,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`actorName` varchar(160),
	`action` varchar(80) NOT NULL,
	`entityType` varchar(40),
	`entityId` varchar(64),
	`ip` varchar(64),
	`userAgent` varchar(512),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`subject` varchar(220) NOT NULL,
	`message` text NOT NULL,
	`locale` varchar(8) NOT NULL DEFAULT 'en',
	`status` enum('new','read','replied') NOT NULL DEFAULT 'new',
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` text NOT NULL,
	`storageKey` varchar(512),
	`filename` varchar(255) NOT NULL,
	`mime` varchar(100) NOT NULL,
	`size` int NOT NULL DEFAULT 0,
	`alt` text,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`locale` varchar(8) NOT NULL DEFAULT 'en',
	`status` enum('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` varchar(80) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE INDEX `article_translations_locale_idx` ON `article_translations` (`locale`);--> statement-breakpoint
CREATE INDEX `article_views_created_idx` ON `article_views` (`createdAt`);--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `articles_category_idx` ON `articles` (`category`,`subcategory`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`createdAt`);