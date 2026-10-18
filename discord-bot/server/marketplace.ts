import { randomUUID } from "node:crypto";
import mysql, { type Pool } from "mysql2/promise";
import { MemberAuthError, type PublicMember } from "./memberAuth.js";
import { assertMarketplaceRegistrationAccess } from "./marketplaceAccess.js";
import { assertMarketplaceMinimumPrice, recordMarketplacePriceDropAlert } from "./marketplacePriceProtection.js";

export type MarketplaceListingStatus = "active" | "reserved" | "completed" | "cancelled";
export type MarketplaceRequestStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";

export interface MarketplaceMonsterSnapshot {
  id: string;
  name: string;
  attribute: string | null;
  type: string | null;
  level: string | null;
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  sellerNickname: string;
  sellerGameNickname: string;
  monster: MarketplaceMonsterSnapshot;
  quantity: number;
  priceBoxes: number;
  note: string | null;
  status: MarketplaceListingStatus;
  reservedByRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceTradeRequest {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  buyerNickname: string;
  buyerGameNickname: string;
  requestedQuantity: number;
  requestedPriceBoxes: number;
  message: string | null;
  status: MarketplaceRequestStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing: Pick<MarketplaceListing, "monster" | "quantity" | "priceBoxes" | "sellerNickname" | "sellerGameNickname" | "status">;
}

export interface MarketplaceBuyOrder {
  id: string;
  buyerId: string;
  buyerNickname: string;
  buyerGameNickname: string;
  monster: MarketplaceMonsterSnapshot;
  quantity: number;
  offerBoxes: number;
  note: string | null;
  status: MarketplaceListingStatus;
  reservedByOfferId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceSaleOffer {
  id: string;
  buyOrderId: string;
  buyerId: string;
  sellerId: string;
  sellerNickname: string;
  sellerGameNickname: string;
  offeredQuantity: number;
  offeredPriceBoxes: number;
  message: string | null;
  status: MarketplaceRequestStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyOrder: Pick<MarketplaceBuyOrder, "monster" | "quantity" | "offerBoxes" | "buyerNickname" | "buyerGameNickname" | "status">;
}

export interface MarketplacePriceSummary {
  monsterId: string;
  recentCompletedCount: number;
  recentAverageBoxesPerUnit: number | null;
  baselineBoxesPerUnit: number | null;
  displayBoxesPerUnit: number | null;
  source: "recent" | "baseline" | "unavailable";
}

export interface CreateMarketplaceListingInput {
  monster: MarketplaceMonsterSnapshot;
  quantity: unknown;
  priceBoxes?: unknown;
  unitPriceBoxes?: unknown;
  note?: unknown;
}

export interface CreateMarketplaceRequestInput {
  requestedQuantity?: unknown;
  message?: unknown;
}

export interface CreateMarketplaceBuyOrderInput {
  monster: MarketplaceMonsterSnapshot;
  quantity: unknown;
  offerBoxes?: unknown;
  unitOfferBoxes?: unknown;
  note?: unknown;
}

export interface CreateMarketplaceSaleOfferInput {
  offeredQuantity?: unknown;
  message?: unknown;
}

type MarketplacePool = Pick<Pool, "query" | "execute">;
type DatabaseRow = Record<string, unknown>;

let pool: Pool | undefined;
let testPool: MarketplacePool | undefined;

export function setMarketplacePoolForTesting(nextPool: MarketplacePool | undefined) {
  testPool = nextPool;
  pool = undefined;
}

function getPool(): MarketplacePool {
  if (testPool) return testPool;
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "거래소 데이터베이스가 설정되지 않았습니다.");
  pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

function timestamp(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function safeRows(result: unknown): DatabaseRow[] {
  if (!Array.isArray(result)) return [];
  const rows = result[0];
  return Array.isArray(rows) ? rows as DatabaseRow[] : [];
}

function affectedRows(result: unknown) {
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== "object") return 0;
  return Number((result[0] as { affectedRows?: unknown }).affectedRows || 0);
}

function normalizePositiveInteger(value: unknown, label: string, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new MemberAuthError("INVALID_INPUT", `${label}은 1~${maximum.toLocaleString("ko-KR")} 사이의 정수로 입력해 주세요.`);
  }
  return parsed;
}

function normalizeOptionalMessage(value: unknown, label: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new MemberAuthError("INVALID_INPUT", `${label} 형식이 올바르지 않습니다.`);
  const normalized = value.trim();
  if (normalized.length > 300) throw new MemberAuthError("INVALID_INPUT", `${label}은 300자 이하로 입력해 주세요.`);
  return normalized || null;
}

function unitPriceOf(totalBoxes: number, quantity: number, label: string) {
  if (totalBoxes % quantity !== 0) {
    throw new MemberAuthError("INVALID_INPUT", `${label}은 수량으로 나누어떨어지게 입력해 주세요. 부분 거래는 마리당 동일한 자사 가격으로 계산됩니다.`);
  }
  return totalBoxes / quantity;
}

function bundlePriceFromUnit(unitValue: unknown, totalValue: unknown, quantity: number, unitLabel: string, totalLabel: string) {
  if (unitValue === undefined || unitValue === null) return normalizePositiveInteger(totalValue, totalLabel, 9_999_999);
  const unitPrice = normalizePositiveInteger(unitValue, unitLabel, 9_999_999);
  const totalPrice = unitPrice * quantity;
  if (!Number.isSafeInteger(totalPrice) || totalPrice > 9_999_999) {
    throw new MemberAuthError("INVALID_INPUT", `${totalLabel}은 9,999,999개 이하로 입력해 주세요.`);
  }
  return totalPrice;
}

async function assertHenchListingMinimumPrice(monsterId: string, totalBoxes: number, quantity: number, label: string) {
  const unitPrice = unitPriceOf(totalBoxes, quantity, label);
  const [summary] = await getMarketplacePriceSummaries([monsterId]);
  assertMarketplaceMinimumPrice({ pricePerUnit: unitPrice, referencePricePerUnit: summary?.displayBoxesPerUnit ?? null, label });
}

function listingFromRow(row: DatabaseRow): MarketplaceListing {
  return {
    id: String(row.id),
    sellerId: String(row.sellerId),
    sellerNickname: String(row.sellerNickname),
    sellerGameNickname: String(row.sellerGameNickname),
    monster: {
      id: row.monsterId ? String(row.monsterId) : "",
      name: String(row.monsterName),
      attribute: row.monsterAttribute ? String(row.monsterAttribute) : null,
      type: row.monsterType ? String(row.monsterType) : null,
      level: row.monsterLevel ? String(row.monsterLevel) : null,
    },
    quantity: Number(row.quantity),
    priceBoxes: Number(row.priceBoxes),
    note: row.note ? String(row.note) : null,
    status: row.status as MarketplaceListingStatus,
    reservedByRequestId: row.reservedByRequestId ? String(row.reservedByRequestId) : null,
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
    updatedAt: timestamp(row.updatedAt) || new Date(0).toISOString(),
  };
}

function requestFromRow(row: DatabaseRow): MarketplaceTradeRequest {
  return {
    id: String(row.id),
    listingId: String(row.listingId),
    sellerId: String(row.sellerId),
    buyerId: String(row.buyerId),
    buyerNickname: String(row.buyerNickname),
    buyerGameNickname: String(row.buyerGameNickname),
    requestedQuantity: Number(row.requestedQuantity),
    requestedPriceBoxes: Number(row.requestedPriceBoxes),
    message: row.message ? String(row.message) : null,
    status: row.status as MarketplaceRequestStatus,
    respondedAt: timestamp(row.respondedAt),
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
    updatedAt: timestamp(row.updatedAt) || new Date(0).toISOString(),
    listing: {
      monster: {
        id: row.monsterId ? String(row.monsterId) : "",
        name: String(row.monsterName),
        attribute: row.monsterAttribute ? String(row.monsterAttribute) : null,
        type: row.monsterType ? String(row.monsterType) : null,
        level: row.monsterLevel ? String(row.monsterLevel) : null,
      },
      quantity: Number(row.quantity),
      priceBoxes: Number(row.priceBoxes),
      sellerNickname: String(row.listingSellerNickname),
      sellerGameNickname: String(row.listingSellerGameNickname),
      status: row.listingStatus as MarketplaceListingStatus,
    },
  };
}

function buyOrderFromRow(row: DatabaseRow): MarketplaceBuyOrder {
  return {
    id: String(row.id),
    buyerId: String(row.buyerId),
    buyerNickname: String(row.buyerNickname),
    buyerGameNickname: String(row.buyerGameNickname),
    monster: {
      id: row.monsterId ? String(row.monsterId) : "",
      name: String(row.monsterName),
      attribute: row.monsterAttribute ? String(row.monsterAttribute) : null,
      type: row.monsterType ? String(row.monsterType) : null,
      level: row.monsterLevel ? String(row.monsterLevel) : null,
    },
    quantity: Number(row.quantity),
    offerBoxes: Number(row.offerBoxes),
    note: row.note ? String(row.note) : null,
    status: row.status as MarketplaceListingStatus,
    reservedByOfferId: row.reservedByOfferId ? String(row.reservedByOfferId) : null,
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
    updatedAt: timestamp(row.updatedAt) || new Date(0).toISOString(),
  };
}

function saleOfferFromRow(row: DatabaseRow): MarketplaceSaleOffer {
  return {
    id: String(row.id),
    buyOrderId: String(row.buyOrderId),
    buyerId: String(row.buyerId),
    sellerId: String(row.sellerId),
    sellerNickname: String(row.sellerNickname),
    sellerGameNickname: String(row.sellerGameNickname),
    offeredQuantity: Number(row.offeredQuantity),
    offeredPriceBoxes: Number(row.offeredPriceBoxes),
    message: row.message ? String(row.message) : null,
    status: row.status as MarketplaceRequestStatus,
    respondedAt: timestamp(row.respondedAt),
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
    updatedAt: timestamp(row.updatedAt) || new Date(0).toISOString(),
    buyOrder: {
      monster: {
        id: row.monsterId ? String(row.monsterId) : "",
        name: String(row.monsterName),
        attribute: row.monsterAttribute ? String(row.monsterAttribute) : null,
        type: row.monsterType ? String(row.monsterType) : null,
        level: row.monsterLevel ? String(row.monsterLevel) : null,
      },
      quantity: Number(row.offeredQuantity),
      offerBoxes: Number(row.offeredPriceBoxes),
      buyerNickname: String(row.orderBuyerNickname),
      buyerGameNickname: String(row.orderBuyerGameNickname),
      status: row.orderStatus as MarketplaceListingStatus,
    },
  };
}

const listingColumns = `
  id, seller_id AS sellerId, seller_nickname AS sellerNickname, seller_game_nickname AS sellerGameNickname,
  monster_id AS monsterId, monster_name AS monsterName, monster_attribute AS monsterAttribute,
  monster_type AS monsterType, monster_level AS monsterLevel, quantity, price_boxes AS priceBoxes,
  note, status, reserved_by_request_id AS reservedByRequestId, created_at AS createdAt, updated_at AS updatedAt`;

const requestColumns = `
  r.id, r.listing_id AS listingId, r.seller_id AS sellerId, r.buyer_id AS buyerId,
  r.buyer_nickname AS buyerNickname, r.buyer_game_nickname AS buyerGameNickname,
  r.requested_quantity AS requestedQuantity, r.requested_price_boxes AS requestedPriceBoxes,
  r.message, r.status, r.responded_at AS respondedAt,
  r.created_at AS createdAt, r.updated_at AS updatedAt,
  l.monster_id AS monsterId, l.monster_name AS monsterName, l.monster_attribute AS monsterAttribute,
  l.monster_type AS monsterType, l.monster_level AS monsterLevel, l.quantity, l.price_boxes AS priceBoxes,
  l.seller_nickname AS listingSellerNickname, l.seller_game_nickname AS listingSellerGameNickname,
  l.status AS listingStatus`;

const buyOrderColumns = `
  id, buyer_id AS buyerId, buyer_nickname AS buyerNickname, buyer_game_nickname AS buyerGameNickname,
  monster_id AS monsterId, monster_name AS monsterName, monster_attribute AS monsterAttribute,
  monster_type AS monsterType, monster_level AS monsterLevel, quantity, offer_boxes AS offerBoxes,
  note, status, reserved_by_offer_id AS reservedByOfferId, created_at AS createdAt, updated_at AS updatedAt`;

const saleOfferColumns = `
  o.id, o.buy_order_id AS buyOrderId, o.buyer_id AS buyerId, o.seller_id AS sellerId,
  o.seller_nickname AS sellerNickname, o.seller_game_nickname AS sellerGameNickname,
  o.offered_quantity AS offeredQuantity, o.offered_price_boxes AS offeredPriceBoxes,
  o.message, o.status, o.responded_at AS respondedAt,
  o.created_at AS createdAt, o.updated_at AS updatedAt,
  b.monster_id AS monsterId, b.monster_name AS monsterName, b.monster_attribute AS monsterAttribute,
  b.monster_type AS monsterType, b.monster_level AS monsterLevel, b.quantity, b.offer_boxes AS offerBoxes,
  b.buyer_nickname AS orderBuyerNickname, b.buyer_game_nickname AS orderBuyerGameNickname,
  b.status AS orderStatus`;

export async function getMarketplacePriceSummaries(monsterIds: string[]): Promise<MarketplacePriceSummary[]> {
  const ids = Array.from(new Set(monsterIds.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const [completedResult, baselineResult] = await Promise.all([
    getPool().query(
      `SELECT completed.monsterId, COUNT(*) AS recentCompletedCount,
              SUM(completed.totalBoxes) / NULLIF(SUM(completed.quantity), 0) AS recentAverageBoxesPerUnit
       FROM (
         SELECT l.monster_id AS monsterId, r.requested_price_boxes AS totalBoxes, r.requested_quantity AS quantity
         FROM marketplace_trade_requests r
         INNER JOIN marketplace_listings l ON l.id = r.listing_id
         WHERE r.status = 'completed' AND r.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
           AND l.monster_id IN (${placeholders})
         UNION ALL
         SELECT b.monster_id AS monsterId, o.offered_price_boxes AS totalBoxes, o.offered_quantity AS quantity
         FROM marketplace_sale_offers o
         INNER JOIN marketplace_buy_orders b ON b.id = o.buy_order_id
         WHERE o.status = 'completed' AND o.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
           AND b.monster_id IN (${placeholders})
       ) AS completed
       GROUP BY completed.monsterId`,
      [...ids, ...ids],
    ),
    getPool().query(
      `SELECT monster_id AS monsterId, boxes_per_unit AS boxesPerUnit
       FROM marketplace_price_baselines WHERE monster_id IN (${placeholders})`,
      ids,
    ),
  ]);

  const completedByMonster = new Map(safeRows(completedResult).map((row) => [String(row.monsterId), row]));
  const baselineByMonster = new Map(safeRows(baselineResult).map((row) => [String(row.monsterId), Number(row.boxesPerUnit)]));
  return ids.map((monsterId) => {
    const completed = completedByMonster.get(monsterId);
    const recentCompletedCount = Number(completed?.recentCompletedCount || 0);
    const recentAverageBoxesPerUnit = recentCompletedCount > 0 ? Math.round(Number(completed?.recentAverageBoxesPerUnit || 0)) : null;
    const baselineBoxesPerUnit = baselineByMonster.get(monsterId) ?? null;
    const source = recentAverageBoxesPerUnit !== null ? "recent" : baselineBoxesPerUnit !== null ? "baseline" : "unavailable";
    return {
      monsterId,
      recentCompletedCount,
      recentAverageBoxesPerUnit,
      baselineBoxesPerUnit,
      displayBoxesPerUnit: recentAverageBoxesPerUnit ?? baselineBoxesPerUnit,
      source,
    };
  });
}

export async function syncMarketplaceMonsterSnapshot(monster: MarketplaceMonsterSnapshot): Promise<void> {
  const values = [monster.name, monster.attribute, monster.type, monster.level, monster.id];
  await Promise.all([
    getPool().execute("UPDATE marketplace_listings SET monster_name=?, monster_attribute=?, monster_type=?, monster_level=?, updated_at=updated_at WHERE monster_id=?", values),
    getPool().execute("UPDATE marketplace_buy_orders SET monster_name=?, monster_attribute=?, monster_type=?, monster_level=?, updated_at=updated_at WHERE monster_id=?", values),
  ]);
}

export async function listMarketplaceListings(query = "", limit = 100): Promise<MarketplaceListing[]> {
  const keyword = query.trim().slice(0, 80);
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const conditions = ["status = 'active'"];
  const values: unknown[] = [];
  if (keyword) {
    conditions.push("monster_name LIKE ?");
    values.push(`%${keyword}%`);
  }
  values.push(safeLimit);
  const result = await getPool().query(
    `SELECT ${listingColumns} FROM marketplace_listings WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    values,
  );
  return safeRows(result).map(listingFromRow);
}

export async function listMyMarketplaceListings(memberId: string): Promise<MarketplaceListing[]> {
  const result = await getPool().query(
    `SELECT ${listingColumns} FROM marketplace_listings WHERE seller_id = ? ORDER BY created_at DESC LIMIT 100`,
    [memberId],
  );
  return safeRows(result).map(listingFromRow);
}

export async function getMarketplaceListing(listingId: string): Promise<MarketplaceListing | null> {
  const result = await getPool().query(
    `SELECT ${listingColumns} FROM marketplace_listings WHERE id = ? LIMIT 1`,
    [listingId],
  );
  const row = safeRows(result)[0];
  return row ? listingFromRow(row) : null;
}

export async function createMarketplaceListing(member: PublicMember, input: CreateMarketplaceListingInput): Promise<MarketplaceListing> {
  await assertMarketplaceRegistrationAccess(member, "sell");
  const monster = input.monster;
  if (!monster || !monster.id || !monster.name) {
    throw new MemberAuthError("INVALID_INPUT", "등록할 헨치를 선택해 주세요.");
  }
  const quantity = normalizePositiveInteger(input.quantity, "판매 수량", 9_999);
  const priceBoxes = bundlePriceFromUnit(input.unitPriceBoxes, input.priceBoxes, quantity, "마리당 자사 가격", "판매 자사 전체 가격");
  await assertHenchListingMinimumPrice(monster.id, priceBoxes, quantity, "판매 자사 가격");
  const note = normalizeOptionalMessage(input.note, "판매 메모");
  const id = randomUUID();

  await getPool().execute(
    `INSERT INTO marketplace_listings
      (id, seller_id, seller_nickname, seller_game_nickname, monster_id, monster_name, monster_attribute, monster_type, monster_level, quantity, price_boxes, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, member.id, member.nickname, member.gameNickname, monster.id, monster.name, monster.attribute, monster.type, monster.level, quantity, priceBoxes, note],
  );
  const listing = await getMarketplaceListing(id);
  if (!listing) throw new MemberAuthError("SETUP_ERROR", "등록한 판매글을 확인하지 못했습니다.");
  return listing;
}

export async function cancelMarketplaceListing(memberId: string, listingId: string): Promise<MarketplaceListing> {
  const result = await getPool().execute(
    "UPDATE marketplace_listings SET status = 'cancelled' WHERE id = ? AND seller_id = ? AND status = 'active'",
    [listingId, memberId],
  );
  if (affectedRows(result) === 0) throw new MemberAuthError("INVALID_INPUT", "판매 중인 내 글만 취소할 수 있습니다.");
  const listing = await getMarketplaceListing(listingId);
  if (!listing) throw new MemberAuthError("INVALID_INPUT", "판매글을 찾을 수 없습니다.");
  return listing;
}

export async function createMarketplaceTradeRequest(member: PublicMember, listingId: string, input: CreateMarketplaceRequestInput): Promise<MarketplaceTradeRequest> {
  const listing = await getMarketplaceListing(listingId);
  if (!listing || listing.status !== "active") throw new MemberAuthError("INVALID_INPUT", "현재 거래 요청을 받을 수 없는 판매글입니다.");
  if (listing.sellerId === member.id) throw new MemberAuthError("FORBIDDEN", "본인의 판매글에는 거래 요청을 보낼 수 없습니다.");

  const duplicate = await getPool().query(
    "SELECT id FROM marketplace_trade_requests WHERE listing_id = ? AND buyer_id = ? AND status = 'pending' LIMIT 1",
    [listingId, member.id],
  );
  if (safeRows(duplicate).length > 0) throw new MemberAuthError("INVALID_INPUT", "이미 이 판매글에 거래 요청을 보냈습니다.");

  const id = randomUUID();
  const requestedQuantity = normalizePositiveInteger(input.requestedQuantity ?? listing.quantity, "요청 수량", listing.quantity);
  const requestedPriceBoxes = unitPriceOf(listing.priceBoxes, listing.quantity, "판매글 자사 가격") * requestedQuantity;
  const message = normalizeOptionalMessage(input.message, "거래 요청 메모");
  await getPool().execute(
    `INSERT INTO marketplace_trade_requests
      (id, listing_id, seller_id, buyer_id, buyer_nickname, buyer_game_nickname, requested_quantity, requested_price_boxes, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, listing.id, listing.sellerId, member.id, member.nickname, member.gameNickname, requestedQuantity, requestedPriceBoxes, message],
  );
  const request = await getMarketplaceTradeRequest(id);
  if (!request) throw new MemberAuthError("SETUP_ERROR", "거래 요청을 확인하지 못했습니다.");
  return request;
}

export async function getMarketplaceTradeRequest(requestId: string): Promise<MarketplaceTradeRequest | null> {
  const result = await getPool().query(
    `SELECT ${requestColumns}
     FROM marketplace_trade_requests r INNER JOIN marketplace_listings l ON l.id = r.listing_id
     WHERE r.id = ? LIMIT 1`,
    [requestId],
  );
  const row = safeRows(result)[0];
  return row ? requestFromRow(row) : null;
}

export async function listMyMarketplaceTradeRequests(memberId: string): Promise<{ selling: MarketplaceTradeRequest[]; buying: MarketplaceTradeRequest[] }> {
  const [sellingResult, buyingResult] = await Promise.all([
    getPool().query(
      `SELECT ${requestColumns}
       FROM marketplace_trade_requests r INNER JOIN marketplace_listings l ON l.id = r.listing_id
       WHERE r.seller_id = ? ORDER BY r.created_at DESC LIMIT 100`,
      [memberId],
    ),
    getPool().query(
      `SELECT ${requestColumns}
       FROM marketplace_trade_requests r INNER JOIN marketplace_listings l ON l.id = r.listing_id
       WHERE r.buyer_id = ? ORDER BY r.created_at DESC LIMIT 100`,
      [memberId],
    ),
  ]);
  return { selling: safeRows(sellingResult).map(requestFromRow), buying: safeRows(buyingResult).map(requestFromRow) };
}

export async function respondToMarketplaceTradeRequest(sellerId: string, requestId: string, action: "accept" | "reject"): Promise<MarketplaceTradeRequest> {
  const request = await getMarketplaceTradeRequest(requestId);
  if (!request || request.sellerId !== sellerId || request.status !== "pending") {
    throw new MemberAuthError("INVALID_INPUT", "처리할 수 있는 거래 요청이 아닙니다.");
  }

  if (action === "reject") {
    const result = await getPool().execute(
      "UPDATE marketplace_trade_requests SET status = 'rejected', responded_at = NOW() WHERE id = ? AND seller_id = ? AND status = 'pending'",
      [requestId, sellerId],
    );
    if (affectedRows(result) === 0) throw new MemberAuthError("INVALID_INPUT", "이미 처리된 거래 요청입니다.");
  } else {
    const listingResult = await getPool().execute(
      "UPDATE marketplace_listings SET status = 'reserved', reserved_by_request_id = ? WHERE id = ? AND seller_id = ? AND status = 'active'",
      [requestId, request.listingId, sellerId],
    );
    if (affectedRows(listingResult) === 0) throw new MemberAuthError("INVALID_INPUT", "판매글이 이미 다른 거래 요청으로 처리되었습니다.");
    const acceptedResult = await getPool().execute(
      "UPDATE marketplace_trade_requests SET status = 'accepted', responded_at = NOW() WHERE id = ? AND seller_id = ? AND status = 'pending'",
      [requestId, sellerId],
    );
    if (affectedRows(acceptedResult) === 0) {
      await getPool().execute(
        "UPDATE marketplace_listings SET status = 'active', reserved_by_request_id = NULL WHERE id = ? AND reserved_by_request_id = ?",
        [request.listingId, requestId],
      );
      throw new MemberAuthError("INVALID_INPUT", "거래 요청 상태가 변경되어 예약을 취소했습니다.");
    }
    await getPool().execute(
      "UPDATE marketplace_trade_requests SET status = 'rejected', responded_at = NOW() WHERE listing_id = ? AND id <> ? AND status = 'pending'",
      [request.listingId, requestId],
    );
  }

  const updated = await getMarketplaceTradeRequest(requestId);
  if (!updated) throw new MemberAuthError("SETUP_ERROR", "처리한 거래 요청을 확인하지 못했습니다.");
  return updated;
}

export async function cancelMarketplaceTradeRequest(buyerId: string, requestId: string): Promise<MarketplaceTradeRequest> {
  const result = await getPool().execute(
    "UPDATE marketplace_trade_requests SET status = 'cancelled', responded_at = NOW() WHERE id = ? AND buyer_id = ? AND status = 'pending'",
    [requestId, buyerId],
  );
  if (affectedRows(result) === 0) throw new MemberAuthError("INVALID_INPUT", "대기 중인 내 거래 요청만 취소할 수 있습니다.");
  const request = await getMarketplaceTradeRequest(requestId);
  if (!request) throw new MemberAuthError("INVALID_INPUT", "거래 요청을 찾을 수 없습니다.");
  return request;
}

export async function completeMarketplaceTrade(sellerId: string, requestId: string): Promise<MarketplaceTradeRequest> {
  const request = await getMarketplaceTradeRequest(requestId);
  if (!request || request.sellerId !== sellerId || request.status !== "accepted" || request.listing.status !== "reserved") {
    throw new MemberAuthError("INVALID_INPUT", "완료 처리할 수 있는 예약 거래가 아닙니다.");
  }
  const listingResult = await getPool().execute(
    `UPDATE marketplace_listings
     SET quantity = quantity - ?, price_boxes = price_boxes - ?,
         status = CASE WHEN quantity - ? = 0 THEN 'completed' ELSE 'active' END,
         reserved_by_request_id = NULL
     WHERE id = ? AND seller_id = ? AND status = 'reserved' AND reserved_by_request_id = ?
       AND quantity >= ? AND price_boxes >= ?`,
    [request.requestedQuantity, request.requestedPriceBoxes, request.requestedQuantity, request.listingId, sellerId, requestId, request.requestedQuantity, request.requestedPriceBoxes],
  );
  if (affectedRows(listingResult) === 0) throw new MemberAuthError("INVALID_INPUT", "예약 상태를 확인하지 못했습니다.");
  await getPool().execute(
    "UPDATE marketplace_trade_requests SET status = 'completed' WHERE id = ? AND seller_id = ? AND status = 'accepted'",
    [requestId, sellerId],
  );
  try {
    const [summary] = await getMarketplacePriceSummaries([request.listing.monster.id]);
    await recordMarketplacePriceDropAlert({
      targetType: "hench",
      targetKey: request.listing.monster.id,
      targetName: request.listing.monster.name,
      baselineBoxesPerUnit: summary?.baselineBoxesPerUnit ?? null,
      recentAverageBoxesPerUnit: summary?.recentAverageBoxesPerUnit ?? null,
      source: "completed-hench-trade",
    });
  } catch (error) {
    console.error("Failed to record marketplace hench price alert:", error);
  }
  const updated = await getMarketplaceTradeRequest(requestId);
  if (!updated) throw new MemberAuthError("SETUP_ERROR", "완료한 거래 요청을 확인하지 못했습니다.");
  return updated;
}

export async function listMarketplaceBuyOrders(query = "", limit = 100): Promise<MarketplaceBuyOrder[]> {
  const keyword = query.trim().slice(0, 80);
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const conditions = ["status = 'active'"];
  const values: unknown[] = [];
  if (keyword) {
    conditions.push("monster_name LIKE ?");
    values.push(`%${keyword}%`);
  }
  values.push(safeLimit);
  const result = await getPool().query(
    `SELECT ${buyOrderColumns} FROM marketplace_buy_orders WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    values,
  );
  return safeRows(result).map(buyOrderFromRow);
}

export async function listMyMarketplaceBuyOrders(memberId: string): Promise<MarketplaceBuyOrder[]> {
  const result = await getPool().query(
    `SELECT ${buyOrderColumns} FROM marketplace_buy_orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 100`,
    [memberId],
  );
  return safeRows(result).map(buyOrderFromRow);
}

export async function getMarketplaceBuyOrder(buyOrderId: string): Promise<MarketplaceBuyOrder | null> {
  const result = await getPool().query(`SELECT ${buyOrderColumns} FROM marketplace_buy_orders WHERE id = ? LIMIT 1`, [buyOrderId]);
  const row = safeRows(result)[0];
  return row ? buyOrderFromRow(row) : null;
}

export async function createMarketplaceBuyOrder(member: PublicMember, input: CreateMarketplaceBuyOrderInput): Promise<MarketplaceBuyOrder> {
  await assertMarketplaceRegistrationAccess(member, "buy");
  const monster = input.monster;
  if (!monster || !monster.id || !monster.name) throw new MemberAuthError("INVALID_INPUT", "구매할 헨치를 선택해 주세요.");
  const quantity = normalizePositiveInteger(input.quantity, "구매 수량", 9_999);
  const offerBoxes = bundlePriceFromUnit(input.unitOfferBoxes, input.offerBoxes, quantity, "마리당 제시 자사", "구매 제시 자사 전체 가격");
  await assertHenchListingMinimumPrice(monster.id, offerBoxes, quantity, "구매 제시 자사");
  const note = normalizeOptionalMessage(input.note, "구매 메모");
  const id = randomUUID();
  await getPool().execute(
    `INSERT INTO marketplace_buy_orders
      (id, buyer_id, buyer_nickname, buyer_game_nickname, monster_id, monster_name, monster_attribute, monster_type, monster_level, quantity, offer_boxes, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, member.id, member.nickname, member.gameNickname, monster.id, monster.name, monster.attribute, monster.type, monster.level, quantity, offerBoxes, note],
  );
  const buyOrder = await getMarketplaceBuyOrder(id);
  if (!buyOrder) throw new MemberAuthError("SETUP_ERROR", "등록한 구매글을 확인하지 못했습니다.");
  return buyOrder;
}

export async function cancelMarketplaceBuyOrder(memberId: string, buyOrderId: string): Promise<MarketplaceBuyOrder> {
  const result = await getPool().execute(
    "UPDATE marketplace_buy_orders SET status = 'cancelled' WHERE id = ? AND buyer_id = ? AND status = 'active'",
    [buyOrderId, memberId],
  );
  if (affectedRows(result) === 0) throw new MemberAuthError("INVALID_INPUT", "구매 중인 내 글만 취소할 수 있습니다.");
  const buyOrder = await getMarketplaceBuyOrder(buyOrderId);
  if (!buyOrder) throw new MemberAuthError("INVALID_INPUT", "구매글을 찾을 수 없습니다.");
  return buyOrder;
}

export async function createMarketplaceSaleOffer(member: PublicMember, buyOrderId: string, input: CreateMarketplaceSaleOfferInput): Promise<MarketplaceSaleOffer> {
  const buyOrder = await getMarketplaceBuyOrder(buyOrderId);
  if (!buyOrder || buyOrder.status !== "active") throw new MemberAuthError("INVALID_INPUT", "현재 판매 제안을 받을 수 없는 구매글입니다.");
  if (buyOrder.buyerId === member.id) throw new MemberAuthError("FORBIDDEN", "본인의 구매글에는 판매 제안을 보낼 수 없습니다.");
  const duplicate = await getPool().query(
    "SELECT id FROM marketplace_sale_offers WHERE buy_order_id = ? AND seller_id = ? AND status = 'pending' LIMIT 1",
    [buyOrderId, member.id],
  );
  if (safeRows(duplicate).length > 0) throw new MemberAuthError("INVALID_INPUT", "이미 이 구매글에 판매 제안을 보냈습니다.");
  const id = randomUUID();
  const offeredQuantity = normalizePositiveInteger(input.offeredQuantity ?? buyOrder.quantity, "판매 제안 수량", buyOrder.quantity);
  const offeredPriceBoxes = unitPriceOf(buyOrder.offerBoxes, buyOrder.quantity, "구매글 제시 자사") * offeredQuantity;
  const message = normalizeOptionalMessage(input.message, "판매 제안 메모");
  await getPool().execute(
    `INSERT INTO marketplace_sale_offers
      (id, buy_order_id, buyer_id, seller_id, seller_nickname, seller_game_nickname, offered_quantity, offered_price_boxes, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, buyOrder.id, buyOrder.buyerId, member.id, member.nickname, member.gameNickname, offeredQuantity, offeredPriceBoxes, message],
  );
  const offer = await getMarketplaceSaleOffer(id);
  if (!offer) throw new MemberAuthError("SETUP_ERROR", "판매 제안을 확인하지 못했습니다.");
  return offer;
}

export async function getMarketplaceSaleOffer(offerId: string): Promise<MarketplaceSaleOffer | null> {
  const result = await getPool().query(
    `SELECT ${saleOfferColumns}
     FROM marketplace_sale_offers o INNER JOIN marketplace_buy_orders b ON b.id = o.buy_order_id
     WHERE o.id = ? LIMIT 1`,
    [offerId],
  );
  const row = safeRows(result)[0];
  return row ? saleOfferFromRow(row) : null;
}

export async function listMyMarketplaceSaleOffers(memberId: string): Promise<{ received: MarketplaceSaleOffer[]; sent: MarketplaceSaleOffer[] }> {
  const [receivedResult, sentResult] = await Promise.all([
    getPool().query(
      `SELECT ${saleOfferColumns}
       FROM marketplace_sale_offers o INNER JOIN marketplace_buy_orders b ON b.id = o.buy_order_id
       WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 100`,
      [memberId],
    ),
    getPool().query(
      `SELECT ${saleOfferColumns}
       FROM marketplace_sale_offers o INNER JOIN marketplace_buy_orders b ON b.id = o.buy_order_id
       WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 100`,
      [memberId],
    ),
  ]);
  return { received: safeRows(receivedResult).map(saleOfferFromRow), sent: safeRows(sentResult).map(saleOfferFromRow) };
}

export async function respondToMarketplaceSaleOffer(buyerId: string, offerId: string, action: "accept" | "reject"): Promise<MarketplaceSaleOffer> {
  const offer = await getMarketplaceSaleOffer(offerId);
  if (!offer || offer.buyerId !== buyerId || offer.status !== "pending") throw new MemberAuthError("INVALID_INPUT", "처리할 수 있는 판매 제안이 아닙니다.");
  if (action === "reject") {
    const result = await getPool().execute(
      "UPDATE marketplace_sale_offers SET status = 'rejected', responded_at = NOW() WHERE id = ? AND buyer_id = ? AND status = 'pending'",
      [offerId, buyerId],
    );
    if (affectedRows(result) === 0) throw new MemberAuthError("INVALID_INPUT", "이미 처리된 판매 제안입니다.");
  } else {
    const orderResult = await getPool().execute(
      "UPDATE marketplace_buy_orders SET status = 'reserved', reserved_by_offer_id = ? WHERE id = ? AND buyer_id = ? AND status = 'active'",
      [offerId, offer.buyOrderId, buyerId],
    );
    if (affectedRows(orderResult) === 0) throw new MemberAuthError("INVALID_INPUT", "구매글이 이미 다른 판매 제안으로 처리되었습니다.");
    const acceptedResult = await getPool().execute(
      "UPDATE marketplace_sale_offers SET status = 'accepted', responded_at = NOW() WHERE id = ? AND buyer_id = ? AND status = 'pending'",
      [offerId, buyerId],
    );
    if (affectedRows(acceptedResult) === 0) {
      await getPool().execute("UPDATE marketplace_buy_orders SET status = 'active', reserved_by_offer_id = NULL WHERE id = ? AND reserved_by_offer_id = ?", [offer.buyOrderId, offerId]);
      throw new MemberAuthError("INVALID_INPUT", "판매 제안 상태가 변경되어 예약을 취소했습니다.");
    }
    await getPool().execute(
      "UPDATE marketplace_sale_offers SET status = 'rejected', responded_at = NOW() WHERE buy_order_id = ? AND id <> ? AND status = 'pending'",
      [offer.buyOrderId, offerId],
    );
  }
  const updated = await getMarketplaceSaleOffer(offerId);
  if (!updated) throw new MemberAuthError("SETUP_ERROR", "처리한 판매 제안을 확인하지 못했습니다.");
  return updated;
}

export async function cancelMarketplaceSaleOffer(sellerId: string, offerId: string): Promise<MarketplaceSaleOffer> {
  const result = await getPool().execute(
    "UPDATE marketplace_sale_offers SET status = 'cancelled', responded_at = NOW() WHERE id = ? AND seller_id = ? AND status = 'pending'",
    [offerId, sellerId],
  );
  if (affectedRows(result) === 0) throw new MemberAuthError("INVALID_INPUT", "대기 중인 내 판매 제안만 취소할 수 있습니다.");
  const offer = await getMarketplaceSaleOffer(offerId);
  if (!offer) throw new MemberAuthError("INVALID_INPUT", "판매 제안을 찾을 수 없습니다.");
  return offer;
}

export async function completeMarketplaceBuyOrder(buyerId: string, offerId: string): Promise<MarketplaceSaleOffer> {
  const offer = await getMarketplaceSaleOffer(offerId);
  if (!offer || offer.buyerId !== buyerId || offer.status !== "accepted" || offer.buyOrder.status !== "reserved") {
    throw new MemberAuthError("INVALID_INPUT", "완료 처리할 수 있는 예약 거래가 아닙니다.");
  }
  const orderResult = await getPool().execute(
    `UPDATE marketplace_buy_orders
     SET quantity = quantity - ?, offer_boxes = offer_boxes - ?,
         status = CASE WHEN quantity - ? = 0 THEN 'completed' ELSE 'active' END,
         reserved_by_offer_id = NULL
     WHERE id = ? AND buyer_id = ? AND status = 'reserved' AND reserved_by_offer_id = ?
       AND quantity >= ? AND offer_boxes >= ?`,
    [offer.offeredQuantity, offer.offeredPriceBoxes, offer.offeredQuantity, offer.buyOrderId, buyerId, offerId, offer.offeredQuantity, offer.offeredPriceBoxes],
  );
  if (affectedRows(orderResult) === 0) throw new MemberAuthError("INVALID_INPUT", "예약 상태를 확인하지 못했습니다.");
  await getPool().execute("UPDATE marketplace_sale_offers SET status = 'completed' WHERE id = ? AND buyer_id = ? AND status = 'accepted'", [offerId, buyerId]);
  try {
    const [summary] = await getMarketplacePriceSummaries([offer.buyOrder.monster.id]);
    await recordMarketplacePriceDropAlert({
      targetType: "hench",
      targetKey: offer.buyOrder.monster.id,
      targetName: offer.buyOrder.monster.name,
      baselineBoxesPerUnit: summary?.baselineBoxesPerUnit ?? null,
      recentAverageBoxesPerUnit: summary?.recentAverageBoxesPerUnit ?? null,
      source: "completed-hench-buy-order",
    });
  } catch (error) {
    console.error("Failed to record marketplace hench buy-order price alert:", error);
  }
  const updated = await getMarketplaceSaleOffer(offerId);
  if (!updated) throw new MemberAuthError("SETUP_ERROR", "완료한 판매 제안을 확인하지 못했습니다.");
  return updated;
}
