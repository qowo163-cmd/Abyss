ALTER TABLE `marketplace_sale_offers` ADD `offered_price_boxes` int;--> statement-breakpoint
ALTER TABLE `marketplace_trade_requests` ADD `requested_price_boxes` int;--> statement-breakpoint
UPDATE `marketplace_trade_requests` r
INNER JOIN `marketplace_listings` l ON l.id = r.listing_id
SET r.requested_price_boxes = ROUND(l.price_boxes / NULLIF(l.quantity, 0)) * r.requested_quantity
WHERE r.requested_price_boxes IS NULL;--> statement-breakpoint
UPDATE `marketplace_sale_offers` o
INNER JOIN `marketplace_buy_orders` b ON b.id = o.buy_order_id
SET o.offered_price_boxes = ROUND(b.offer_boxes / NULLIF(b.quantity, 0)) * o.offered_quantity
WHERE o.offered_price_boxes IS NULL;--> statement-breakpoint
ALTER TABLE `marketplace_sale_offers` MODIFY `offered_price_boxes` int NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_trade_requests` MODIFY `requested_price_boxes` int NOT NULL;
