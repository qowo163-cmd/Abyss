CREATE TABLE `marketplace_exchange_listings` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`owner_nickname` varchar(40) NOT NULL,
	`owner_game_nickname` varchar(80) NOT NULL,
	`offered_monster_id` varchar(36) NOT NULL,
	`offered_monster_name` varchar(120) NOT NULL,
	`offered_monster_attribute` varchar(40),
	`offered_monster_type` varchar(40),
	`offered_monster_level` varchar(40),
	`offered_quantity` int NOT NULL,
	`note` varchar(300),
	`status` enum('active','reserved','completed','cancelled') NOT NULL DEFAULT 'active',
	`reserved_by_offer_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_exchange_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_exchange_offers` (
	`id` varchar(36) NOT NULL,
	`exchange_listing_id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`proposer_id` varchar(36) NOT NULL,
	`proposer_nickname` varchar(40) NOT NULL,
	`proposer_game_nickname` varchar(80) NOT NULL,
	`offered_monster_id` varchar(36) NOT NULL,
	`offered_monster_name` varchar(120) NOT NULL,
	`offered_monster_attribute` varchar(40),
	`offered_monster_type` varchar(40),
	`offered_monster_level` varchar(40),
	`offered_quantity` int NOT NULL,
	`message` varchar(300),
	`status` enum('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
	`responded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_exchange_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_exchange_wants` (
	`id` varchar(36) NOT NULL,
	`exchange_listing_id` varchar(36) NOT NULL,
	`monster_id` varchar(36) NOT NULL,
	`monster_name` varchar(120) NOT NULL,
	`monster_attribute` varchar(40),
	`monster_type` varchar(40),
	`monster_level` varchar(40),
	`quantity` int NOT NULL,
	CONSTRAINT `marketplace_exchange_wants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_exchange_listings_status_idx` ON `marketplace_exchange_listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `marketplace_exchange_listings_owner_idx` ON `marketplace_exchange_listings` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_exchange_offers_listing_idx` ON `marketplace_exchange_offers` (`exchange_listing_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_exchange_offers_owner_idx` ON `marketplace_exchange_offers` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_exchange_offers_proposer_idx` ON `marketplace_exchange_offers` (`proposer_id`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_exchange_wants_listing_idx` ON `marketplace_exchange_wants` (`exchange_listing_id`);--> statement-breakpoint
CREATE INDEX `marketplace_exchange_wants_monster_idx` ON `marketplace_exchange_wants` (`monster_id`);