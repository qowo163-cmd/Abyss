CREATE TABLE `security_events` (
	`id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`member_username` varchar(24) NOT NULL,
	`member_nickname` varchar(40) NOT NULL,
	`event_type` varchar(40) NOT NULL,
	`path` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`acknowledged_at` timestamp,
	`acknowledged_by` varchar(36),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `security_events_created_idx` ON `security_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_member_created_idx` ON `security_events` (`member_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_acknowledged_created_idx` ON `security_events` (`acknowledged_at`,`created_at`);