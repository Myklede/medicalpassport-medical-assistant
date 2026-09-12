CREATE TABLE `insurance_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`document_id` text NOT NULL,
	`condition_text` text NOT NULL,
	`network_status` text NOT NULL,
	`estimated_cost_cents` integer,
	`result_json` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `insurance_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_insurance_analyses_patient_date` ON `insurance_analyses` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_insurance_analyses_document_date` ON `insurance_analyses` (`document_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `insurance_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`storage_object_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`extraction_status` text NOT NULL,
	`page_count` integer NOT NULL,
	`benefits_json` text NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storage_object_id`) REFERENCES `storage_objects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insurance_documents_storage_object_id_unique` ON `insurance_documents` (`storage_object_id`);--> statement-breakpoint
CREATE INDEX `idx_insurance_documents_patient_date` ON `insurance_documents` (`patient_id`,`created_at`);