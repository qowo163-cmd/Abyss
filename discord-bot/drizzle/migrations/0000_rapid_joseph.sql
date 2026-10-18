CREATE TABLE `member_accounts` (
	`id` varchar(36) NOT NULL,
	`username` varchar(24) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`nickname` varchar(40) NOT NULL,
	`discord_nickname` varchar(80) NOT NULL,
	`game_nickname` varchar(80) NOT NULL,
	`role` enum('member','admin') NOT NULL DEFAULT 'member',
	`status` enum('pending','approved','suspended') NOT NULL DEFAULT 'pending',
	`approved_at` timestamp,
	`approved_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `member_sessions` (
	`id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `member_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `member_accounts_status_created_idx` ON `member_accounts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `member_sessions_member_expires_idx` ON `member_sessions` (`member_id`,`expires_at`);