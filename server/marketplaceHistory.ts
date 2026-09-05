import mysql, { type Pool } from "mysql2/promise";
import { MemberAuthError } from "./memberAuth.js";

export type MarketplaceHistoryCategory = "all" | "hench" | "item";
export type MarketplaceHistoryType = "sell" | "buy" | "exchange";
export type MarketplaceHistoryStatus = "active" | "reserved" | "completed" | "cancelled" | "pending" | "accepted" | "rejected";
export type MarketplaceHistoryCurrency = "boxes" | "gp" | "exchange";
export type MarketplaceHistoryRecordKind = "listing" | "request";

export interface MarketplaceHistoryEntry {
  id: string;
  rawId: string;
  recordKind: MarketplaceHistoryRecordKind;
  category: Exclude<MarketplaceHistoryCategory, "all">;
  listingType: MarketplaceHistoryType;
  subjectName: string;
  quantity: number;
  priceAmount: number | null;
  priceCurrency: MarketplaceHistoryCurrency;
  ownerNickname: string;
  ownerGameNickname: string;
  counterpartNickname: string | null;
  counterpartGameNickname: string | null;
  status: MarketplaceHistoryStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceHistoryFilters {
  category?: unknown;
  listingType?: unknown;
  status?: unknown;
  query?: unknown;
  days?: unknown;
  limit?: unknown;
}

type HistoryPool = Pick<Pool, "query">;
type Row = Record<string, unknown>;
let pool: Pool | undefined;
let testPool: HistoryPool | undefined;

export function setMarketplaceHistoryPoolForTesting(nextPool: HistoryPool | undefined) {
  testPool = nextPool;
  pool = undefined;
}

function db(): HistoryPool {
  if (testPool) return testPool;
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "거래소 데이터베이스가 설정되지 않았습니다.");
  pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

function rows(result: unknown): Row[] {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] as Row[] : [];
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : new Date(0).toISOString();
}

function optionalText(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T) {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? value as T : fallback;
}

function limitOf(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? Math.max(1, Math.min(500, numeric)) : 200;
}

function daysOf(value: unknown) {
  const numeric = Number(value);
  return [7, 30, 90].includes(numeric) ? numeric : null;
}

function historyFrom(row: Row): MarketplaceHistoryEntry {
  const category = row.category === "item" ? "item" : "hench";
  const recordKind = row.recordKind === "request" ? "request" : "listing";
  const listingType = oneOf(row.listingType, ["sell", "buy", "exchange"] as const, "sell");
  const status = oneOf(row.status, ["active", "reserved", "completed", "cancelled", "pending", "accepted", "rejected"] as const, "active");
  const priceCurrency = oneOf(row.priceCurrency, ["boxes", "gp", "exchange"] as const, "boxes");
  return {
    id: `${category}-${recordKind}-${listingType}-${String(row.id)}`,
    rawId: String(row.id),
    recordKind,
    category,
    listingType,
    subjectName: String(row.subjectName || "알 수 없는 거래 대상"),
    quantity: Number(row.quantity || 0),
    priceAmount: row.priceAmount === null || row.priceAmount === undefined ? null : Number(row.priceAmount),
    priceCurrency,
    ownerNickname: String(row.ownerNickname || "-"),
    ownerGameNickname: String(row.ownerGameNickname || "-"),
    counterpartNickname: optionalText(row.counterpartNickname),
    counterpartGameNickname: optionalText(row.counterpartGameNickname),
    status,
    note: optionalText(row.note),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listMarketplaceHistory(filters: MarketplaceHistoryFilters = {}) {
  const category = oneOf(filters.category, ["all", "hench", "item"] as const, "all");
  const listingType = oneOf(filters.listingType, ["all", "sell", "buy", "exchange"] as const, "all");
  const status = oneOf(filters.status, ["all", "active", "reserved", "completed", "cancelled", "pending", "accepted", "rejected"] as const, "all");
  const query = typeof filters.query === "string" ? filters.query.trim().slice(0, 120) : "";
  const days = daysOf(filters.days);
  const clauses = ["1=1"];
  const params: Array<string | number> = [];

  if (category !== "all") { clauses.push("history.category = ?"); params.push(category); }
  if (listingType !== "all") { clauses.push("history.listingType = ?"); params.push(listingType); }
  if (status !== "all") { clauses.push("history.status = ?"); params.push(status); }
  if (query) {
    clauses.push("(history.subjectName LIKE ? OR history.ownerNickname LIKE ? OR history.ownerGameNickname LIKE ? OR history.counterpartNickname LIKE ? OR history.counterpartGameNickname LIKE ?)");
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (days) clauses.push(`history.updatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${days} DAY)`);
  params.push(limitOf(filters.limit));

  const result = await db().query(`
    SELECT * FROM (
      SELECT l.id, 'listing' AS recordKind, 'hench' AS category, 'sell' AS listingType, l.monster_name AS subjectName, l.quantity,
        l.price_boxes AS priceAmount, 'boxes' AS priceCurrency, l.seller_nickname AS ownerNickname,
        l.seller_game_nickname AS ownerGameNickname, r.buyer_nickname AS counterpartNickname,
        r.buyer_game_nickname AS counterpartGameNickname, l.status, l.note, l.created_at AS createdAt, l.updated_at AS updatedAt
      FROM marketplace_listings l LEFT JOIN marketplace_trade_requests r ON r.id = l.reserved_by_request_id
      UNION ALL
      SELECT r.id, 'request', 'hench', 'sell', l.monster_name, r.requested_quantity, r.requested_price_boxes, 'boxes',
        r.buyer_nickname, r.buyer_game_nickname, l.seller_nickname, l.seller_game_nickname, r.status, r.message, r.created_at, r.updated_at
      FROM marketplace_trade_requests r INNER JOIN marketplace_listings l ON l.id = r.listing_id
      UNION ALL
      SELECT b.id, 'listing', 'hench', 'buy', b.monster_name, b.quantity, b.offer_boxes, 'boxes', b.buyer_nickname,
        b.buyer_game_nickname, o.seller_nickname, o.seller_game_nickname, b.status, b.note, b.created_at, b.updated_at
      FROM marketplace_buy_orders b LEFT JOIN marketplace_sale_offers o ON o.id = b.reserved_by_offer_id
      UNION ALL
      SELECT o.id, 'request', 'hench', 'buy', b.monster_name, o.offered_quantity, o.offered_price_boxes, 'boxes',
        o.seller_nickname, o.seller_game_nickname, b.buyer_nickname, b.buyer_game_nickname, o.status, o.message, o.created_at, o.updated_at
      FROM marketplace_sale_offers o INNER JOIN marketplace_buy_orders b ON b.id = o.buy_order_id
      UNION ALL
      SELECT e.id, 'listing', 'hench', 'exchange', e.offered_monster_name, e.offered_quantity, NULL, 'exchange', e.owner_nickname,
        e.owner_game_nickname, o.proposer_nickname, o.proposer_game_nickname, e.status, e.note, e.created_at, e.updated_at
      FROM marketplace_exchange_listings e LEFT JOIN marketplace_exchange_offers o ON o.id = e.reserved_by_offer_id
      UNION ALL
      SELECT o.id, 'request', 'hench', 'exchange', CONCAT(o.offered_monster_name, ' → ', e.offered_monster_name), o.offered_quantity, NULL, 'exchange',
        o.proposer_nickname, o.proposer_game_nickname, e.owner_nickname, e.owner_game_nickname, o.status, o.message, o.created_at, o.updated_at
      FROM marketplace_exchange_offers o INNER JOIN marketplace_exchange_listings e ON e.id = o.exchange_listing_id
      UNION ALL
      SELECT i.id, 'listing', 'item', i.listing_type, i.item_name, i.quantity, i.price_boxes, i.price_currency, i.owner_nickname,
        i.owner_game_nickname, r.requester_nickname, r.requester_game_nickname, i.status, i.note, i.created_at, i.updated_at
      FROM marketplace_item_listings i LEFT JOIN marketplace_item_requests r ON r.id = i.reserved_by_request_id
      UNION ALL
      SELECT r.id, 'request', 'item', i.listing_type, i.item_name, r.requested_quantity, i.price_boxes, i.price_currency,
        r.requester_nickname, r.requester_game_nickname, i.owner_nickname, i.owner_game_nickname, r.status, r.message, r.created_at, r.updated_at
      FROM marketplace_item_requests r INNER JOIN marketplace_item_listings i ON i.id = r.listing_id
    ) history
    WHERE ${clauses.join(" AND ")}
    ORDER BY history.updatedAt DESC, history.createdAt DESC
    LIMIT ?`, params);

  return rows(result).map(historyFrom);
}

// 각 (구분·기록종류·방식) 조합이 실제로 어느 DB 테이블에 저장되는지 연결해둔 표입니다.
// listMarketplaceHistory의 UNION 쿼리 구조와 정확히 같은 매핑이어야 해요.
const HISTORY_TABLE_MAP: Record<string, string> = {
  "hench-listing-sell": "marketplace_listings",
  "hench-request-sell": "marketplace_trade_requests",
  "hench-listing-buy": "marketplace_buy_orders",
  "hench-request-buy": "marketplace_sale_offers",
  "hench-listing-exchange": "marketplace_exchange_listings",
  "hench-request-exchange": "marketplace_exchange_offers",
  "item-listing-sell": "marketplace_item_listings",
  "item-listing-buy": "marketplace_item_listings",
  "item-listing-exchange": "marketplace_item_listings",
  "item-request-sell": "marketplace_item_requests",
  "item-request-buy": "marketplace_item_requests",
  "item-request-exchange": "marketplace_item_requests",
};

export async function deleteMarketplaceHistoryRecord(category: unknown, recordKind: unknown, listingType: unknown, rawId: unknown) {
  const safeCategory = oneOf(category, ["hench", "item"] as const, "hench");
  const safeRecordKind = oneOf(recordKind, ["listing", "request"] as const, "listing");
  const safeListingType = oneOf(listingType, ["sell", "buy", "exchange"] as const, "sell");
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) throw new MemberAuthError("INVALID_INPUT", "삭제할 거래 기록을 찾을 수 없습니다.");

  const table = HISTORY_TABLE_MAP[`${safeCategory}-${safeRecordKind}-${safeListingType}`];
  if (!table) throw new MemberAuthError("INVALID_INPUT", "삭제할 수 없는 거래 기록 종류입니다.");

  const result = await db().query(`DELETE FROM ${table} WHERE id = ? LIMIT 1`, [id]);
  const affectedRows = Array.isArray(result) ? (result[0] as { affectedRows?: number })?.affectedRows ?? 0 : 0;
  if (!affectedRows) throw new MemberAuthError("INVALID_INPUT", "이미 삭제되었거나 존재하지 않는 거래 기록입니다.");
}
