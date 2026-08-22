CREATE TABLE `invite_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(255) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`role` enum('admin','staff') NOT NULL DEFAULT 'staff',
	`used` boolean NOT NULL DEFAULT false,
	`expires_at` datetime NOT NULL,
	`created_by` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `invite_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `invite_tokens` ADD CONSTRAINT `invite_tokens_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;