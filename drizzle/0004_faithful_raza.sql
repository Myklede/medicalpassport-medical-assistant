CREATE TABLE `wound_lab_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`profile_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wound_lab_sessions_visitor_patient` ON `wound_lab_sessions` (`visitor_id`,`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wound_lab_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`day` real NOT NULL,
	`captured_at` text NOT NULL,
	`image_object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`image_sha256` text NOT NULL,
	`measurement_json` text NOT NULL,
	`provenance_json` text NOT NULL,
	`pipeline_visuals_json` text,
	`analysis_status` text NOT NULL,
	`analysis_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `wound_lab_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wound_lab_visits_image_object_key_unique` ON `wound_lab_visits` (`image_object_key`);--> statement-breakpoint
CREATE INDEX `idx_wound_lab_visits_session_day` ON `wound_lab_visits` (`session_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_wound_lab_visits_session_capture` ON `wound_lab_visits` (`session_id`,`captured_at`);