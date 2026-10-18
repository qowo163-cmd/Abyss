CREATE TABLE `marketplace_price_baselines` (
	`monster_id` varchar(36) NOT NULL,
	`monster_name` varchar(120) NOT NULL,
	`boxes_per_unit` int NOT NULL,
	`source_label` varchar(80) NOT NULL DEFAULT 'initial-price-list',
	`updated_by` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_price_baselines_monster_id` PRIMARY KEY(`monster_id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_price_baselines_name_idx` ON `marketplace_price_baselines` (`monster_name`);