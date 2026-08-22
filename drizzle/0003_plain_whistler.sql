CREATE TABLE `amc_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amount_paise` int NOT NULL DEFAULT 599900,
	`razorpay_order_id` varchar(255) NOT NULL,
	`razorpay_payment_id` varchar(255),
	`razorpay_signature` varchar(500),
	`payment_status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`year` int NOT NULL,
	`valid_until` datetime NOT NULL,
	`paid_at` datetime,
	`paid_by` int,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `amc_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `amc_payments` ADD CONSTRAINT `amc_payments_paid_by_users_id_fk` FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;