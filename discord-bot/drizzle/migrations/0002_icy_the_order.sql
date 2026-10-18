CREATE TABLE `monster_data_store` (
	`id` varchar(36) NOT NULL,
	`data` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monster_data_store_id` PRIMARY KEY(`id`)
);
