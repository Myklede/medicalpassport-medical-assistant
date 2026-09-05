CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_subject` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_auth_subject_unique` ON `app_users` (`auth_subject`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`patient_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_patient_date` ON `audit_events` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `health_records` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`record_type` text NOT NULL,
	`fhir_resource_type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`status` text NOT NULL,
	`clinical_date` text NOT NULL,
	`provider` text,
	`facility` text,
	`country_code` text,
	`code_system` text,
	`code` text,
	`source` text NOT NULL,
	`verification_status` text NOT NULL,
	`severity` text,
	`details_json` text NOT NULL,
	`attachment_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attachment_id`) REFERENCES `storage_objects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_records_patient_date` ON `health_records` (`patient_id`,`clinical_date`);--> statement-breakpoint
CREATE INDEX `idx_records_patient_type` ON `health_records` (`patient_id`,`record_type`);--> statement-breakpoint
CREATE INDEX `idx_records_patient_status` ON `health_records` (`patient_id`,`status`);--> statement-breakpoint
CREATE TABLE `patient_memberships` (
	`patient_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	PRIMARY KEY(`patient_id`, `user_id`),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_membership_user` ON `patient_memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`birth_date` text,
	`blood_type` text,
	`preferred_language` text,
	`emergency_contact_name` text,
	`emergency_contact_phone` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` text NOT NULL,
	`purpose` text NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_objects_object_key_unique` ON `storage_objects` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_storage_patient` ON `storage_objects` (`patient_id`,`created_at`);