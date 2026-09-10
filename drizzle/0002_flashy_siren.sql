CREATE TABLE `portal_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`resource_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `portal_spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_portal_changes_workspace_date` ON `portal_changes` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `portal_documents` (
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	`mutation_id` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `portal_spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `portal_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`seeded_at` text NOT NULL
);
