CREATE TABLE `member_ip_access_logs` (
	`id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`first_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `member_ip_access_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_ip_access_logs_member_ip_unique` UNIQUE(`member_id`,`ip_address`)
);
--> statement-breakpoint
ALTER TABLE `member_accounts` ADD `last_ip_address` varchar(45);--> statement-breakpoint
CREATE INDEX `member_ip_access_logs_member_seen_idx` ON `member_ip_access_logs` (`member_id`,`last_seen_at`);