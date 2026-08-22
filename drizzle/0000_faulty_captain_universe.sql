CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(500) NOT NULL,
	`record_id` int,
	`user_id` int,
	`details` text,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cremation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deceased_name` varchar(255) NOT NULL,
	`date_of_birth` datetime,
	`date_of_death` datetime NOT NULL,
	`time_of_death` varchar(10),
	`age_at_death` int,
	`gender` enum('male','female','other'),
	`nationality` varchar(100),
	`religion` varchar(100),
	`place_of_death` varchar(500),
	`cremation_date` datetime,
	`cremation_time` varchar(10),
	`funeral_pyre_no` varchar(50),
	`next_of_kin_name` varchar(255),
	`next_of_kin_phone` varchar(50),
	`next_of_kin_relation` varchar(100),
	`next_of_kin_address` text,
	`cause_of_death` text,
	`doctor_name` varchar(255),
	`hospital_name` varchar(255),
	`death_certificate_no` varchar(100),
	`record_status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
	`rejection_reason` text,
	`created_by` int NOT NULL,
	`reviewed_by` int,
	`reviewed_at` datetime,
	`notes` text,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `cremation_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`record_id` int NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`storage_path` varchar(1000) NOT NULL,
	`mime_type` varchar(255),
	`file_size` int NOT NULL DEFAULT 0,
	`document_type` varchar(100),
	`uploaded_by` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(255) NOT NULL DEFAULT '',
	`role` enum('admin','staff') NOT NULL DEFAULT 'staff',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_record_id_cremation_records_id_fk` FOREIGN KEY (`record_id`) REFERENCES `cremation_records`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cremation_records` ADD CONSTRAINT `cremation_records_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cremation_records` ADD CONSTRAINT `cremation_records_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_record_id_cremation_records_id_fk` FOREIGN KEY (`record_id`) REFERENCES `cremation_records`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;