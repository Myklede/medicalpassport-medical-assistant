CREATE TABLE `ai_inferences` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`wound_case_id` text NOT NULL,
	`wound_assessment_id` text NOT NULL,
	`task` text NOT NULL,
	`model_name` text NOT NULL,
	`model_version` text NOT NULL,
	`status` text NOT NULL,
	`output_json` text NOT NULL,
	`confidence_json` text NOT NULL,
	`input_manifest_json` text NOT NULL,
	`requires_review` integer DEFAULT true NOT NULL,
	`reviewed_by_user_id` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wound_case_id`) REFERENCES `wound_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wound_assessment_id`) REFERENCES `wound_assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_inferences_assessment` ON `ai_inferences` (`wound_assessment_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_inferences_patient_date` ON `ai_inferences` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wound_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`wound_case_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`image_object_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`pain_score` integer NOT NULL,
	`symptoms_json` text NOT NULL,
	`capture_json` text NOT NULL,
	`notes` text,
	`triage_level` text NOT NULL,
	`triage_reasons_json` text NOT NULL,
	`history_factors_json` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`wound_case_id`) REFERENCES `wound_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_object_id`) REFERENCES `storage_objects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wound_assessments_case_date` ON `wound_assessments` (`wound_case_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `idx_wound_assessments_patient_date` ON `wound_assessments` (`patient_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `wound_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`label` text NOT NULL,
	`body_location` text NOT NULL,
	`wound_type` text NOT NULL,
	`onset_date` text,
	`status` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wound_cases_patient_status` ON `wound_cases` (`patient_id`,`status`);