CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`plant_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`payload` text,
	`photo_path` text,
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_plant_occurred_idx` ON `events` (`plant_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`plant_id` text NOT NULL,
	`path` text NOT NULL,
	`taken_at` integer NOT NULL,
	`width` integer,
	`height` integer,
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_plant_taken_idx` ON `photos` (`plant_id`,`taken_at`);--> statement-breakpoint
CREATE TABLE `plant_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`plant_id` text NOT NULL,
	`task_code` text NOT NULL,
	`month_start` integer NOT NULL,
	`month_end` integer NOT NULL,
	`label_ko` text NOT NULL,
	`done_year` integer,
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plant_tasks_plant_id_idx` ON `plant_tasks` (`plant_id`);--> statement-breakpoint
CREATE TABLE `plants` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`scientific_name` text,
	`nickname` text NOT NULL,
	`group_code` text NOT NULL,
	`pot_size` text NOT NULL,
	`soil_type` text NOT NULL,
	`is_bonsai` integer DEFAULT false NOT NULL,
	`bonsai_group` text,
	`learn_factor` real DEFAULT 1 NOT NULL,
	`manual_interval` real,
	`last_watered_at` integer NOT NULL,
	`next_water_at` integer,
	`last_repot_at` integer,
	`postpone_count` integer DEFAULT 0 NOT NULL,
	`cover_photo_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plants_space_id_idx` ON `plants` (`space_id`);--> statement-breakpoint
CREATE INDEX `plants_next_water_at_idx` ON `plants` (`next_water_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`photo_path` text,
	`direction` text NOT NULL,
	`space_type` text NOT NULL,
	`light_grade` text NOT NULL,
	`light_source` text NOT NULL,
	`ai_evidence` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `species_cache` (
	`scientific_name` text PRIMARY KEY NOT NULL,
	`name_ko` text,
	`aliases_ko` text,
	`group_code` text NOT NULL,
	`base_interval` real,
	`bonsai_group` text,
	`bonsai_tasks` text,
	`care` text,
	`fertilizer` text,
	`repot_months` integer,
	`repot_season` text,
	`toxic_pet` integer,
	`winter_indoor_ok` integer,
	`source` text NOT NULL,
	`reviewed` integer DEFAULT false NOT NULL,
	`created_at` text,
	`updated_at` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watering_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`plant_id` text NOT NULL,
	`watered_at` integer NOT NULL,
	`soil_state` text NOT NULL,
	`leaf_droop` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`interval_calc` real,
	`factor_snapshot` text,
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watering_logs_plant_watered_idx` ON `watering_logs` (`plant_id`,`watered_at`);