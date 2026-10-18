CREATE TABLE `member_login_attempts` (
	`attempt_key` varchar(64) NOT NULL,
	`failure_count` int NOT NULL DEFAULT 0,
	`window_started_at` timestamp NOT NULL DEFAULT (now()),
	`locked_until` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_login_attempts_attempt_key` PRIMARY KEY(`attempt_key`)
);
--> statement-breakpoint
ALTER TABLE `member_accounts` ADD `last_activity_at` timestamp;--> statement-breakpoint
CREATE INDEX `member_login_attempts_locked_idx` ON `member_login_attempts` (`locked_until`);--> statement-breakpoint
CREATE INDEX `member_accounts_last_activity_idx` ON `member_accounts` (`last_activity_at`);