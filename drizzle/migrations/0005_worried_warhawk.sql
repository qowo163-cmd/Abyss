CREATE TABLE `marketplace_listings` (
	`id` varchar(36) NOT NULL,
	`seller_id` varchar(36) NOT NULL,
	`seller_nickname` varchar(40) NOT NULL,
	`seller_game_nickname` varchar(80) NOT NULL,
	`monster_id` varchar(36),
	`monster_name` varchar(120) NOT NULL,
	`monster_attribute` varchar(40),
	`monster_type` varchar(40),
	`monster_level` varchar(40),
	`quantity` int NOT NULL,
	`price_boxes` int NOT NULL,
	`note` varchar(300),
	`status` enum('active','reserved','completed','cancelled') NOT NULL DEFAULT 'active',
	`reserved_by_request_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_trade_requests` (
	`id` varchar(36) NOT NULL,
	`listing_id` varchar(36) NOT NULL,
	`seller_id` varchar(36) NOT NULL,
	`buyer_id` varchar(36) NOT NULL,
	`buyer_nickname` varchar(40) NOT NULL,
	`buyer_game_nickname` varchar(80) NOT NULL,
	`requested_quantity` int NOT NULL,
	`message` varchar(300),
	`status` enum('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
	`responded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_trade_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_listings_status_created_idx` ON `marketplace_listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `marketplace_listings_monster_status_idx` ON `marketplace_listings` (`monster_name`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_listings_seller_status_idx` ON `marketplace_listings` (`seller_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_trade_requests_listing_status_idx` ON `marketplace_trade_requests` (`listing_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_trade_requests_seller_status_idx` ON `marketplace_trade_requests` (`seller_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_trade_requests_buyer_status_idx` ON `marketplace_trade_requests` (`buyer_id`,`status`);