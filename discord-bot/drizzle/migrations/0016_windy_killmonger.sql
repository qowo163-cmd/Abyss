CREATE TABLE `marketplace_initial_price_snapshots` (
	`target_type` enum('hench','item') NOT NULL,
	`target_key` varchar(120) NOT NULL,
	`line_id` varchar(64) NOT NULL,
	`initial_boxes_per_unit` int,
	CONSTRAINT `marketplace_initial_price_snapshots_target_unique` UNIQUE(`target_type`,`target_key`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_initial_price_snapshots_line_idx` ON `marketplace_initial_price_snapshots` (`line_id`);
--> statement-breakpoint
INSERT INTO `marketplace_initial_price_snapshots` (`target_type`, `target_key`, `line_id`, `initial_boxes_per_unit`)
SELECT
  'hench',
  monster_id,
  CASE
    WHEN source_label = 'user-rule-immortal' THEN 'hench-immortal'
    WHEN source_label = 'user-rule-named-eight' THEN 'hench-named-eight'
    WHEN source_label = 'user-rule-confirmed-exception' AND monster_name = '균형핑크멀' THEN 'hench-confirmed-eight'
    WHEN source_label = 'user-rule-confirmed-exception' THEN 'hench-confirmed-twenty'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 15 THEN 'hench-level-191-199'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 30 THEN 'hench-level-200-207'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 35 THEN 'hench-level-208-215'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 70 THEN 'hench-level-216-223'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 150 THEN 'hench-level-224-231'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 300 THEN 'hench-level-232-239'
    WHEN source_label = 'user-rule-level-band' AND boxes_per_unit = 600 THEN 'hench-level-240'
    ELSE 'hench-other'
  END,
  boxes_per_unit
FROM `marketplace_price_baselines`;
--> statement-breakpoint
INSERT INTO `marketplace_initial_price_snapshots` (`target_type`, `target_key`, `line_id`, `initial_boxes_per_unit`)
SELECT
  'item',
  id,
  CASE
    WHEN name LIKE '분노%혼' THEN 'item-rage-souls'
    WHEN name LIKE '폭주%혼' THEN 'item-rampage-souls'
    ELSE 'item-prism'
  END,
  baseline_boxes_per_unit
FROM `marketplace_item_catalog`
WHERE name LIKE '분노%혼' OR name LIKE '폭주%혼' OR name = '프리즘';
