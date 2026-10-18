CREATE TABLE `marketplace_item_listings` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`owner_nickname` varchar(40) NOT NULL,
	`owner_game_nickname` varchar(80) NOT NULL,
	`listing_type` enum('sell','buy','exchange') NOT NULL,
	`item_name` varchar(120) NOT NULL,
	`quantity` int NOT NULL,
	`price_boxes` int,
	`wanted_items` longtext,
	`note` varchar(300),
	`status` enum('active','reserved','completed','cancelled') NOT NULL DEFAULT 'active',
	`reserved_by_request_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_item_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_item_requests` (
	`id` varchar(36) NOT NULL,
	`listing_id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`requester_id` varchar(36) NOT NULL,
	`requester_nickname` varchar(40) NOT NULL,
	`requester_game_nickname` varchar(80) NOT NULL,
	`requested_quantity` int NOT NULL,
	`offered_item_name` varchar(120),
	`offered_quantity` int,
	`message` varchar(300),
	`status` enum('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
	`responded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_item_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_item_listings_status_created_idx` ON `marketplace_item_listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `marketplace_item_listings_type_status_idx` ON `marketplace_item_listings` (`listing_type`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_item_listings_name_status_idx` ON `marketplace_item_listings` (`item_name`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_item_listings_owner_status_idx` ON `marketplace_item_listings` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_item_requests_listing_status_idx` ON `marketplace_item_requests` (`listing_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_item_requests_owner_status_idx` ON `marketplace_item_requests` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_item_requests_requester_status_idx` ON `marketplace_item_requests` (`requester_id`,`status`);