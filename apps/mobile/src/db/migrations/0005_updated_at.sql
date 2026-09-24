ALTER TABLE `plants` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 이미 있던 행은 등록한 때를 마지막으로 고친 때로 본다
UPDATE `plants` SET `updated_at` = `created_at` WHERE `updated_at` = 0;--> statement-breakpoint
UPDATE `spaces` SET `updated_at` = `created_at` WHERE `updated_at` = 0;
