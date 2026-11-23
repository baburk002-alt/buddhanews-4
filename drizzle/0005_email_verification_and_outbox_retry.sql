-- users.emailVerified: NULL = the auth provider did not say, TRUE/FALSE = the
-- provider's explicit claim. server/access.ts refuses allowlist matches for
-- accounts the provider reports as unverified.
ALTER TABLE `users` ADD COLUMN `emailVerified` boolean NULL;
--> statement-breakpoint
-- email_outbox.nextAttemptAt drives retry/backoff for the delivery worker.
ALTER TABLE `email_outbox` ADD COLUMN `nextAttemptAt` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `email_outbox_next_idx` ON `email_outbox` (`status`, `nextAttemptAt`);
