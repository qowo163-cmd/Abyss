import { index, int, longtext, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const memberAccounts = mysqlTable(
  "member_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    username: varchar("username", { length: 24 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    nickname: varchar("nickname", { length: 40 }).notNull(),
    discordNickname: varchar("discord_nickname", { length: 80 }).notNull(),
    gameNickname: varchar("game_nickname", { length: 80 }).notNull(),
    role: mysqlEnum("role", ["member", "admin"]).notNull().default("member"),
    status: mysqlEnum("status", ["pending", "approved", "suspended"]).notNull().default("pending"),
    approvedAt: timestamp("approved_at"),
    approvedBy: varchar("approved_by", { length: 36 }),
    lastActivityAt: timestamp("last_activity_at"),
    lastIpAddress: varchar("last_ip_address", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("member_accounts_status_created_idx").on(table.status, table.createdAt),
    index("member_accounts_last_activity_idx").on(table.lastActivityAt),
  ],
);

export const memberIpAccessLogs = mysqlTable(
  "member_ip_access_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    memberId: varchar("member_id", { length: 36 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("member_ip_access_logs_member_ip_unique").on(table.memberId, table.ipAddress),
    index("member_ip_access_logs_member_seen_idx").on(table.memberId, table.lastSeenAt),
  ],
);

export const memberSessions = mysqlTable(
  "member_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    memberId: varchar("member_id", { length: 36 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("member_sessions_member_expires_idx").on(table.memberId, table.expiresAt)],
);

export const memberLoginAttempts = mysqlTable(
  "member_login_attempts",
  {
    attemptKey: varchar("attempt_key", { length: 64 }).primaryKey(),
    failureCount: int("failure_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at").notNull().defaultNow(),
    lockedUntil: timestamp("locked_until"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("member_login_attempts_locked_idx").on(table.lockedUntil)],
);

export const securityEvents = mysqlTable(
  "security_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    memberId: varchar("member_id", { length: 36 }).notNull(),
    memberUsername: varchar("member_username", { length: 24 }).notNull(),
    memberNickname: varchar("member_nickname", { length: 40 }).notNull(),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    path: varchar("path", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedBy: varchar("acknowledged_by", { length: 36 }),
  },
  (table) => [
    index("security_events_created_idx").on(table.createdAt),
    index("security_events_member_created_idx").on(table.memberId, table.createdAt),
    index("security_events_acknowledged_created_idx").on(table.acknowledgedAt, table.createdAt),
  ],
);

export const monsterDataStore = mysqlTable("monster_data_store", {
  id: varchar("id", { length: 36 }).primaryKey(),
  data: longtext("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const marketplaceListings = mysqlTable(
  "marketplace_listings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 36 }).notNull(),
    sellerNickname: varchar("seller_nickname", { length: 40 }).notNull(),
    sellerGameNickname: varchar("seller_game_nickname", { length: 80 }).notNull(),
    monsterId: varchar("monster_id", { length: 36 }),
    monsterName: varchar("monster_name", { length: 120 }).notNull(),
    monsterAttribute: varchar("monster_attribute", { length: 40 }),
    monsterType: varchar("monster_type", { length: 40 }),
    monsterLevel: varchar("monster_level", { length: 40 }),
    quantity: int("quantity").notNull(),
    priceBoxes: int("price_boxes").notNull(),
    note: varchar("note", { length: 300 }),
    status: mysqlEnum("status", ["active", "reserved", "completed", "cancelled"]).notNull().default("active"),
    reservedByRequestId: varchar("reserved_by_request_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("marketplace_listings_status_created_idx").on(table.status, table.createdAt),
    index("marketplace_listings_monster_status_idx").on(table.monsterName, table.status),
    index("marketplace_listings_seller_status_idx").on(table.sellerId, table.status),
  ],
);

export const marketplaceTradeRequests = mysqlTable(
  "marketplace_trade_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    sellerId: varchar("seller_id", { length: 36 }).notNull(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    buyerNickname: varchar("buyer_nickname", { length: 40 }).notNull(),
    buyerGameNickname: varchar("buyer_game_nickname", { length: 80 }).notNull(),
    requestedQuantity: int("requested_quantity").notNull(),
    requestedPriceBoxes: int("requested_price_boxes").notNull(),
    message: varchar("message", { length: 300 }),
    status: mysqlEnum("status", ["pending", "accepted", "rejected", "cancelled", "completed"]).notNull().default("pending"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("marketplace_trade_requests_listing_status_idx").on(table.listingId, table.status),
    index("marketplace_trade_requests_seller_status_idx").on(table.sellerId, table.status),
    index("marketplace_trade_requests_buyer_status_idx").on(table.buyerId, table.status),
  ],
);

export const marketplaceBuyOrders = mysqlTable(
  "marketplace_buy_orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    buyerNickname: varchar("buyer_nickname", { length: 40 }).notNull(),
    buyerGameNickname: varchar("buyer_game_nickname", { length: 80 }).notNull(),
    monsterId: varchar("monster_id", { length: 36 }),
    monsterName: varchar("monster_name", { length: 120 }).notNull(),
    monsterAttribute: varchar("monster_attribute", { length: 40 }),
    monsterType: varchar("monster_type", { length: 40 }),
    monsterLevel: varchar("monster_level", { length: 40 }),
    quantity: int("quantity").notNull(),
    offerBoxes: int("offer_boxes").notNull(),
    note: varchar("note", { length: 300 }),
    status: mysqlEnum("status", ["active", "reserved", "completed", "cancelled"]).notNull().default("active"),
    reservedByOfferId: varchar("reserved_by_offer_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("marketplace_buy_orders_status_created_idx").on(table.status, table.createdAt),
    index("marketplace_buy_orders_monster_status_idx").on(table.monsterName, table.status),
    index("marketplace_buy_orders_buyer_status_idx").on(table.buyerId, table.status),
  ],
);

export const marketplaceSaleOffers = mysqlTable(
  "marketplace_sale_offers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    buyOrderId: varchar("buy_order_id", { length: 36 }).notNull(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    sellerId: varchar("seller_id", { length: 36 }).notNull(),
    sellerNickname: varchar("seller_nickname", { length: 40 }).notNull(),
    sellerGameNickname: varchar("seller_game_nickname", { length: 80 }).notNull(),
    offeredQuantity: int("offered_quantity").notNull(),
    offeredPriceBoxes: int("offered_price_boxes").notNull(),
    message: varchar("message", { length: 300 }),
    status: mysqlEnum("status", ["pending", "accepted", "rejected", "cancelled", "completed"]).notNull().default("pending"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("marketplace_sale_offers_buy_order_status_idx").on(table.buyOrderId, table.status),
    index("marketplace_sale_offers_buyer_status_idx").on(table.buyerId, table.status),
    index("marketplace_sale_offers_seller_status_idx").on(table.sellerId, table.status),
  ],
);

export const marketplacePriceBaselines = mysqlTable(
  "marketplace_price_baselines",
  {
    monsterId: varchar("monster_id", { length: 36 }).primaryKey(),
    monsterName: varchar("monster_name", { length: 120 }).notNull(),
    boxesPerUnit: int("boxes_per_unit").notNull(),
    sourceLabel: varchar("source_label", { length: 80 }).notNull().default("initial-price-list"),
    updatedBy: varchar("updated_by", { length: 36 }),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("marketplace_price_baselines_name_idx").on(table.monsterName)],
);

export const marketplacePriceAlerts = mysqlTable(
  "marketplace_price_alerts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    targetType: mysqlEnum("target_type", ["hench", "item"]).notNull(),
    targetKey: varchar("target_key", { length: 120 }).notNull(),
    targetName: varchar("target_name", { length: 120 }).notNull(),
    baselineBoxesPerUnit: int("baseline_boxes_per_unit").notNull(),
    recentAverageBoxesPerUnit: int("recent_average_boxes_per_unit").notNull(),
    declinePercent: int("decline_percent").notNull(),
    source: varchar("source", { length: 80 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedBy: varchar("acknowledged_by", { length: 36 }),
  },
  (table) => [
    index("marketplace_price_alerts_open_idx").on(table.targetType, table.targetKey, table.acknowledgedAt),
    index("marketplace_price_alerts_created_idx").on(table.createdAt),
  ],
);

export const marketplaceInitialPriceSnapshots = mysqlTable(
  "marketplace_initial_price_snapshots",
  {
    targetType: mysqlEnum("target_type", ["hench", "item"]).notNull(),
    targetKey: varchar("target_key", { length: 120 }).notNull(),
    lineId: varchar("line_id", { length: 64 }).notNull(),
    initialBoxesPerUnit: int("initial_boxes_per_unit"),
  },
  (table) => [
    uniqueIndex("marketplace_initial_price_snapshots_target_unique").on(table.targetType, table.targetKey),
    index("marketplace_initial_price_snapshots_line_idx").on(table.lineId),
  ],
);

export const marketplaceExchangeListings = mysqlTable(
  "marketplace_exchange_listings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 36 }).notNull(),
    ownerNickname: varchar("owner_nickname", { length: 40 }).notNull(),
    ownerGameNickname: varchar("owner_game_nickname", { length: 80 }).notNull(),
    offeredMonsterId: varchar("offered_monster_id", { length: 36 }).notNull(),
    offeredMonsterName: varchar("offered_monster_name", { length: 120 }).notNull(),
    offeredMonsterAttribute: varchar("offered_monster_attribute", { length: 40 }),
    offeredMonsterType: varchar("offered_monster_type", { length: 40 }),
    offeredMonsterLevel: varchar("offered_monster_level", { length: 40 }),
    offeredQuantity: int("offered_quantity").notNull(),
    note: varchar("note", { length: 300 }),
    status: mysqlEnum("status", ["active", "reserved", "completed", "cancelled"]).notNull().default("active"),
    reservedByOfferId: varchar("reserved_by_offer_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("marketplace_exchange_listings_status_idx").on(table.status, table.createdAt), index("marketplace_exchange_listings_owner_idx").on(table.ownerId, table.status)],
);

export const marketplaceExchangeWants = mysqlTable(
  "marketplace_exchange_wants",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    exchangeListingId: varchar("exchange_listing_id", { length: 36 }).notNull(),
    monsterId: varchar("monster_id", { length: 36 }).notNull(),
    monsterName: varchar("monster_name", { length: 120 }).notNull(),
    monsterAttribute: varchar("monster_attribute", { length: 40 }),
    monsterType: varchar("monster_type", { length: 40 }),
    monsterLevel: varchar("monster_level", { length: 40 }),
    quantity: int("quantity").notNull(),
  },
  (table) => [index("marketplace_exchange_wants_listing_idx").on(table.exchangeListingId), index("marketplace_exchange_wants_monster_idx").on(table.monsterId)],
);

export const marketplaceExchangeOffers = mysqlTable(
  "marketplace_exchange_offers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    exchangeListingId: varchar("exchange_listing_id", { length: 36 }).notNull(),
    ownerId: varchar("owner_id", { length: 36 }).notNull(),
    proposerId: varchar("proposer_id", { length: 36 }).notNull(),
    proposerNickname: varchar("proposer_nickname", { length: 40 }).notNull(),
    proposerGameNickname: varchar("proposer_game_nickname", { length: 80 }).notNull(),
    offeredMonsterId: varchar("offered_monster_id", { length: 36 }).notNull(),
    offeredMonsterName: varchar("offered_monster_name", { length: 120 }).notNull(),
    offeredMonsterAttribute: varchar("offered_monster_attribute", { length: 40 }),
    offeredMonsterType: varchar("offered_monster_type", { length: 40 }),
    offeredMonsterLevel: varchar("offered_monster_level", { length: 40 }),
    offeredQuantity: int("offered_quantity").notNull(),
    message: varchar("message", { length: 300 }),
    status: mysqlEnum("status", ["pending", "accepted", "rejected", "cancelled", "completed"]).notNull().default("pending"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("marketplace_exchange_offers_listing_idx").on(table.exchangeListingId, table.status), index("marketplace_exchange_offers_owner_idx").on(table.ownerId, table.status), index("marketplace_exchange_offers_proposer_idx").on(table.proposerId, table.status)],
);

export const marketplaceItemListings = mysqlTable(
  "marketplace_item_listings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 36 }).notNull(),
    ownerNickname: varchar("owner_nickname", { length: 40 }).notNull(),
    ownerGameNickname: varchar("owner_game_nickname", { length: 80 }).notNull(),
    listingType: mysqlEnum("listing_type", ["sell", "buy", "exchange"]).notNull(),
    itemName: varchar("item_name", { length: 120 }).notNull(),
    quantity: int("quantity").notNull(),
    priceBoxes: int("price_boxes"),
    priceCurrency: varchar("price_currency", { length: 12 }).notNull().default("boxes"),
    wantedItems: longtext("wanted_items"),
    note: varchar("note", { length: 300 }),
    status: mysqlEnum("status", ["active", "reserved", "completed", "cancelled"]).notNull().default("active"),
    reservedByRequestId: varchar("reserved_by_request_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("marketplace_item_listings_status_created_idx").on(table.status, table.createdAt),
    index("marketplace_item_listings_type_status_idx").on(table.listingType, table.status),
    index("marketplace_item_listings_name_status_idx").on(table.itemName, table.status),
    index("marketplace_item_listings_owner_status_idx").on(table.ownerId, table.status),
  ],
);

export const marketplaceItemRequests = mysqlTable(
  "marketplace_item_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    ownerId: varchar("owner_id", { length: 36 }).notNull(),
    requesterId: varchar("requester_id", { length: 36 }).notNull(),
    requesterNickname: varchar("requester_nickname", { length: 40 }).notNull(),
    requesterGameNickname: varchar("requester_game_nickname", { length: 80 }).notNull(),
    requestedQuantity: int("requested_quantity").notNull(),
    offeredItemName: varchar("offered_item_name", { length: 120 }),
    offeredQuantity: int("offered_quantity"),
    message: varchar("message", { length: 300 }),
    status: mysqlEnum("status", ["pending", "accepted", "rejected", "cancelled", "completed"]).notNull().default("pending"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("marketplace_item_requests_listing_status_idx").on(table.listingId, table.status),
    index("marketplace_item_requests_owner_status_idx").on(table.ownerId, table.status),
    index("marketplace_item_requests_requester_status_idx").on(table.requesterId, table.status),
  ],
);

export const marketplaceItemCatalog = mysqlTable(
  "marketplace_item_catalog",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    baselineBoxesPerUnit: int("baseline_boxes_per_unit"),
    isActive: int("is_active").notNull().default(1),
    sortOrder: int("sort_order").notNull().default(0),
    updatedBy: varchar("updated_by", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("marketplace_item_catalog_active_sort_idx").on(table.isActive, table.sortOrder), index("marketplace_item_catalog_name_idx").on(table.name)],
);

export const marketplaceTabSettings = mysqlTable("marketplace_tab_settings", {
  id: varchar("id", { length: 32 }).primaryKey(),
  sellEnabled: int("sell_enabled").notNull().default(1),
  buyEnabled: int("buy_enabled").notNull().default(1),
  exchangeEnabled: int("exchange_enabled").notNull().default(1),
  itemsEnabled: int("items_enabled").notNull().default(1),
  updatedBy: varchar("updated_by", { length: 36 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
