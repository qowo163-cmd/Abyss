CREATE TABLE `marketplace_price_alerts` (
	`id` varchar(36) NOT NULL,
	`target_type` enum('hench','item') NOT NULL,
	`target_key` varchar(120) NOT NULL,
	`target_name` varchar(120) NOT NULL,
	`baseline_boxes_per_unit` int NOT NULL,
	`recent_average_boxes_per_unit` int NOT NULL,
	`decline_percent` int NOT NULL,
	`source` varchar(80) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`acknowledged_at` timestamp,
	`acknowledged_by` varchar(36),
	CONSTRAINT `marketplace_price_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_price_alerts_open_idx` ON `marketplace_price_alerts` (`target_type`,`target_key`,`acknowledged_at`);--> statement-breakpoint
CREATE INDEX `marketplace_price_alerts_created_idx` ON `marketplace_price_alerts` (`created_at`);