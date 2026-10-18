CREATE TABLE `marketplace_buy_orders` (
	`id` varchar(36) NOT NULL,
	`buyer_id` varchar(36) NOT NULL,
	`buyer_nickname` varchar(40) NOT NULL,
	`buyer_game_nickname` varchar(80) NOT NULL,
	`monster_id` varchar(36),
	`monster_name` varchar(120) NOT NULL,
	`monster_attribute` varchar(40),
	`monster_type` varchar(40),
	`monster_level` varchar(40),
	`quantity` int NOT NULL,
	`offer_boxes` int NOT NULL,
	`note` varchar(300),
	`status` enum('active','reserved','completed','cancelled') NOT NULL DEFAULT 'active',
	`reserved_by_offer_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_buy_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_sale_offers` (
	`id` varchar(36) NOT NULL,
	`buy_order_id` varchar(36) NOT NULL,
	`buyer_id` varchar(36) NOT NULL,
	`seller_id` varchar(36) NOT NULL,
	`seller_nickname` varchar(40) NOT NULL,
	`seller_game_nickname` varchar(80) NOT NULL,
	`offered_quantity` int NOT NULL,
	`message` varchar(300),
	`status` enum('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
	`responded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_sale_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_buy_orders_status_created_idx` ON `marketplace_buy_orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `marketplace_buy_orders_monster_status_idx` ON `marketplace_buy_orders` (`monster_name`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_buy_orders_buyer_status_idx` ON `marketplace_buy_orders` (`buyer_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_sale_offers_buy_order_status_idx` ON `marketplace_sale_offers` (`buy_order_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_sale_offers_buyer_status_idx` ON `marketplace_sale_offers` (`buyer_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_sale_offers_seller_status_idx` ON `marketplace_sale_offers` (`seller_id`,`status`);