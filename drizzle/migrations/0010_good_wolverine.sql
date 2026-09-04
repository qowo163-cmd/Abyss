CREATE TABLE `marketplace_item_catalog` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`image_url` varchar(500),
	`baseline_boxes_per_unit` int,
	`is_active` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`updated_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_item_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_item_catalog_active_sort_idx` ON `marketplace_item_catalog` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `marketplace_item_catalog_name_idx` ON `marketplace_item_catalog` (`name`);