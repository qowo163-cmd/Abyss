CREATE TABLE `marketplace_tab_settings` (
	`id` varchar(32) NOT NULL,
	`sell_enabled` int NOT NULL DEFAULT 1,
	`buy_enabled` int NOT NULL DEFAULT 1,
	`exchange_enabled` int NOT NULL DEFAULT 1,
	`items_enabled` int NOT NULL DEFAULT 1,
	`updated_by` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_tab_settings_id` PRIMARY KEY(`id`)
);
