import { randomUUID } from "crypto";
import mysql, { type Pool } from "mysql2/promise";
import { DEFAULT_MARKETPLACE_GP_PRICING_RULE, getMarketplaceGpPricingRule, gpPricingValidationMessage, isRampageSoul, isValidGpAmountForRule, RAMPAGE_SOULS_PER_AUTO_HUNT_BOX, type MarketplaceGpPricingRule } from "../shared/marketplaceGpPricing";
import { MemberAuthError, type PublicMember } from "./memberAuth.js";
import { assertMarketplaceRegistrationAccess } from "./marketplaceAccess.js";
import { assertMarketplaceMinimumPrice, recordMarketplacePriceDropAlert } from "./marketplacePriceProtection.js";

export type ItemListingType = "sell" | "buy" | "exchange";
export type ItemListingStatus = "active" | "reserved" | "completed" | "cancelled";
export type ItemRequestStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";
export type ItemWant = { name: string; quantity: number };
export type ItemListing = { id: string; ownerId: string; ownerNickname: string; ownerGameNickname: string; listingType: ItemListingType; itemName: string; quantity: number; priceBoxes: number | null; priceCurrency: "boxes" | "gp"; wantedItems: ItemWant[]; note: string | null; status: ItemListingStatus; reservedByRequestId: string | null; createdAt: string; updatedAt: string };
export type ItemRequest = { id: string; listingId: string; ownerId: string; requesterId: string; requesterNickname: string; requesterGameNickname: string; requestedQuantity: number; offeredItemName: string | null; offeredQuantity: number | null; message: string | null; status: ItemRequestStatus; respondedAt: string | null; createdAt: string; updatedAt: string; listing?: ItemListing };

type Row = Record<string, string | number | Date | null>;
type Db = Pick<Pool, "query" | "execute">;
let pool: Pool | undefined;
let testPool: Db | undefined;

export function setItemMarketplacePoolForTesting(nextPool: Db | undefined) { testPool = nextPool; pool = undefined; }
function db(): Db { if (testPool) return testPool; if (pool) return pool; if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "거래소 데이터베이스가 설정되지 않았습니다."); pool = mysql.createPool(process.env.DATABASE_URL); return pool; }
function rows(result: unknown): Row[] { return Array.isArray(result) && Array.isArray(result[0]) ? result[0] as Row[] : []; }
function affected(result: unknown) { return Array.isArray(result) && result[0] && typeof result[0] === "object" ? Number((result[0] as { affectedRows?: unknown }).affectedRows || 0) : 0; }
function time(value: unknown) { return value instanceof Date ? value.toISOString() : value ? String(value) : new Date(0).toISOString(); }
function qty(value: unknown, label: string) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9999) throw new MemberAuthError("INVALID_INPUT", `${label}은 1~9,999 사이의 정수로 입력해 주세요.`); return parsed; }
function boxes(value: unknown) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9_999_999) throw new MemberAuthError("INVALID_INPUT", "자사 가격은 1~9,999,999 사이의 정수로 입력해 주세요."); return parsed; }
function gp(value: unknown, rule: MarketplaceGpPricingRule) { const parsed = Number(value); if (!isValidGpAmountForRule(parsed, rule)) throw new MemberAuthError("INVALID_INPUT", gpPricingValidationMessage(rule)); return parsed; }
function totalFromUnit(unitPrice: number, quantity: number, label: string) { const total = unitPrice * quantity; if (!Number.isSafeInteger(total)) throw new MemberAuthError("INVALID_INPUT", `${label} 전체 가격이 너무 큽니다.`); return total; }
function selectedPriceCurrency(value: unknown) { if (value === undefined || value === null) return null; if (value === "boxes" || value === "gp") return value; throw new MemberAuthError("INVALID_INPUT", "거래 화폐는 자사 또는 GP 중 하나를 선택해 주세요."); }
function shortText(value: unknown, label: string, max = 120) { if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new MemberAuthError("INVALID_INPUT", `${label}을(를) 1~${max}자로 입력해 주세요.`); return value.trim(); }
function optionalText(value: unknown) { if (value === undefined || value === null) return null; if (typeof value !== "string" || value.trim().length > 300) throw new MemberAuthError("INVALID_INPUT", "메모는 300자 이하로 입력해 주세요."); return value.trim() || null; }
function wants(value: unknown): ItemWant[] { if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new MemberAuthError("INVALID_INPUT", "교환을 원하는 아이템은 1~5종 입력해 주세요."); return value.map((entry) => { const item = entry as { name?: unknown; quantity?: unknown }; return { name: shortText(item.name, "원하는 아이템"), quantity: qty(item.quantity, "요청 수량") }; }); }
function normalizedItemName(value: string) { return value.replace(/\s+/g, "").toLowerCase(); }
function isAutoHuntBox(value: string) { return normalizedItemName(value) === "자동사냥박스"; }
function isOneHundredMillionGp(value: string) { return normalizedItemName(value) === "1억gp"; }
function assertAutoHuntBoxExchangeRule(itemName: string, listingType: ItemListingType, wantedItems: ItemWant[]) {
  const wantsAutoHuntBox = wantedItems.some((item) => isAutoHuntBox(item.name));
  if (isAutoHuntBox(itemName) && listingType === "exchange" && (wantedItems.length !== 1 || !isOneHundredMillionGp(wantedItems[0].name))) throw new MemberAuthError("INVALID_INPUT", "자동사냥박스 교환글은 1억GP와의 교환으로만 등록할 수 있습니다.");
  if (wantsAutoHuntBox && (listingType !== "exchange" || !isOneHundredMillionGp(itemName))) throw new MemberAuthError("INVALID_INPUT", "자동사냥박스를 원하는 교환글은 1억GP를 등록 아이템으로 선택해 주세요.");
}
function assertRampageSoulAutoHuntBoxRate(itemName: string, quantity: number, priceCurrency: "boxes" | "gp", priceBoxes: number | null) {
  if (!isRampageSoul(itemName) || priceCurrency !== "boxes") return;
  if (quantity % RAMPAGE_SOULS_PER_AUTO_HUNT_BOX !== 0) throw new MemberAuthError("INVALID_INPUT", `폭주의 혼은 자동사냥박스 1개당 ${RAMPAGE_SOULS_PER_AUTO_HUNT_BOX}개 단위로 등록해 주세요.`);
  if (priceBoxes !== quantity / RAMPAGE_SOULS_PER_AUTO_HUNT_BOX) throw new MemberAuthError("INVALID_INPUT", `폭주의 혼 ${RAMPAGE_SOULS_PER_AUTO_HUNT_BOX}개는 자동사냥박스 1개 기준으로 등록됩니다.`);
}
async function assertItemListingMinimumPrice(itemName: string, priceCurrency: "boxes" | "gp", totalPrice: number | null, quantity: number) {
  if (!totalPrice) return;
  const recentResult = await db().query(
    `SELECT SUM(l.price_boxes * r.requested_quantity / l.quantity) / NULLIF(SUM(r.requested_quantity), 0) AS averagePrice
     FROM marketplace_item_requests r INNER JOIN marketplace_item_listings l ON l.id = r.listing_id
     WHERE r.status = 'completed' AND l.listing_type IN ('sell', 'buy') AND l.price_currency = ?
       AND r.updated_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND l.item_name = ?`,
    [priceCurrency, itemName],
  );
  const recentAverage = Number(rows(recentResult)[0]?.averagePrice || 0) || null;
  let reference = recentAverage;
  if (reference === null && priceCurrency === "boxes") {
    const baselineResult = await db().query("SELECT baseline_boxes_per_unit AS baselinePrice FROM marketplace_item_catalog WHERE name = ? LIMIT 1", [itemName]);
    reference = Number(rows(baselineResult)[0]?.baselinePrice || 0) || null;
  }
  assertMarketplaceMinimumPrice({ pricePerUnit: totalPrice / quantity, referencePricePerUnit: reference && Math.round(reference), label: `${priceCurrency === "gp" ? "GP" : "자사"} 등록 가격` });
}
function parseWants(value: unknown): ItemWant[] { try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed.filter((item): item is ItemWant => !!item && typeof item.name === "string" && Number.isInteger(item.quantity) && item.quantity > 0) : []; } catch { return []; } }
function listingFrom(row: Row): ItemListing { return { id: String(row.id), ownerId: String(row.ownerId), ownerNickname: String(row.ownerNickname), ownerGameNickname: String(row.ownerGameNickname), listingType: row.listingType as ItemListingType, itemName: String(row.itemName), quantity: Number(row.quantity), priceBoxes: row.priceBoxes === null ? null : Number(row.priceBoxes), priceCurrency: row.priceCurrency === "gp" ? "gp" : "boxes", wantedItems: parseWants(row.wantedItems), note: row.note ? String(row.note) : null, status: row.status as ItemListingStatus, reservedByRequestId: row.reservedByRequestId ? String(row.reservedByRequestId) : null, createdAt: time(row.createdAt), updatedAt: time(row.updatedAt) }; }
function requestFrom(row: Row): ItemRequest { return { id: String(row.id), listingId: String(row.listingId), ownerId: String(row.ownerId), requesterId: String(row.requesterId), requesterNickname: String(row.requesterNickname), requesterGameNickname: String(row.requesterGameNickname), requestedQuantity: Number(row.requestedQuantity), offeredItemName: row.offeredItemName ? String(row.offeredItemName) : null, offeredQuantity: row.offeredQuantity === null ? null : Number(row.offeredQuantity), message: row.message ? String(row.message) : null, status: row.status as ItemRequestStatus, respondedAt: row.respondedAt ? time(row.respondedAt) : null, createdAt: time(row.createdAt), updatedAt: time(row.updatedAt) }; }
const listingColumns = "id, owner_id AS ownerId, owner_nickname AS ownerNickname, owner_game_nickname AS ownerGameNickname, listing_type AS listingType, item_name AS itemName, quantity, price_boxes AS priceBoxes, price_currency AS priceCurrency, wanted_items AS wantedItems, note, status, reserved_by_request_id AS reservedByRequestId, created_at AS createdAt, updated_at AS updatedAt";
const requestColumns = "id, listing_id AS listingId, owner_id AS ownerId, requester_id AS requesterId, requester_nickname AS requesterNickname, requester_game_nickname AS requesterGameNickname, requested_quantity AS requestedQuantity, offered_item_name AS offeredItemName, offered_quantity AS offeredQuantity, message, status, responded_at AS respondedAt, created_at AS createdAt, updated_at AS updatedAt";

export async function listItemListings(query = "", type?: string) { const keyword = query.trim(); const listingType = type === "sell" || type === "buy" || type === "exchange" ? type : null; const clauses = ["status = 'active'"]; const params: string[] = []; if (listingType) { clauses.push("listing_type = ?"); params.push(listingType); } if (keyword) { clauses.push("(item_name LIKE ? OR note LIKE ? OR wanted_items LIKE ?)"); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); } const result = await db().query(`SELECT ${listingColumns} FROM marketplace_item_listings WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 100`, params); return rows(result).map(listingFrom); }
export async function getItemListing(id: string) { const result = await db().query(`SELECT ${listingColumns} FROM marketplace_item_listings WHERE id = ? LIMIT 1`, [id]); const row = rows(result)[0]; return row ? listingFrom(row) : null; }
export async function createItemListing(member: PublicMember, input: { listingType: unknown; itemName: unknown; quantity: unknown; priceBoxes?: unknown; unitPrice?: unknown; priceCurrency?: unknown; wantedItems?: unknown; note?: unknown }) { await assertMarketplaceRegistrationAccess(member, "items"); const listingType = input.listingType; if (listingType !== "sell" && listingType !== "buy" && listingType !== "exchange") throw new MemberAuthError("INVALID_INPUT", "아이템 거래 방식은 판매·구매·교환 중 하나여야 합니다."); const itemName = shortText(input.itemName, listingType === "buy" ? "구매할 아이템" : "등록 아이템"); const quantity = qty(input.quantity, listingType === "buy" ? "구매 수량" : "등록 수량"); const requestedPriceCurrency = selectedPriceCurrency(input.priceCurrency); const gpPricingRule = listingType === "exchange" ? null : getMarketplaceGpPricingRule(itemName); const priceCurrency = listingType === "exchange" ? "boxes" : requestedPriceCurrency ?? (gpPricingRule ? "gp" : "boxes"); const unitPrice = input.unitPrice === undefined || input.unitPrice === null ? null : priceCurrency === "gp" ? gp(input.unitPrice, gpPricingRule ?? DEFAULT_MARKETPLACE_GP_PRICING_RULE) : boxes(input.unitPrice); const priceBoxes = listingType === "exchange" ? null : unitPrice === null ? priceCurrency === "gp" ? gp(input.priceBoxes, gpPricingRule ?? DEFAULT_MARKETPLACE_GP_PRICING_RULE) : boxes(input.priceBoxes) : totalFromUnit(unitPrice, quantity, `${priceCurrency === "gp" ? "GP" : "자사"} 단가`); const wantedItems = listingType === "exchange" ? wants(input.wantedItems) : []; assertAutoHuntBoxExchangeRule(itemName, listingType, wantedItems); assertRampageSoulAutoHuntBoxRate(itemName, quantity, priceCurrency, priceBoxes); await assertItemListingMinimumPrice(itemName, priceCurrency, priceBoxes, quantity); const id = randomUUID(); await db().execute("INSERT INTO marketplace_item_listings (id,owner_id,owner_nickname,owner_game_nickname,listing_type,item_name,quantity,price_boxes,price_currency,wanted_items,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [id, member.id, member.nickname, member.gameNickname, listingType, itemName, quantity, priceBoxes, priceCurrency, JSON.stringify(wantedItems), optionalText(input.note)]); const listing = await getItemListing(id); if (!listing) throw new MemberAuthError("SETUP_ERROR", "아이템 거래글을 확인하지 못했습니다."); return listing; }
export async function createItemRequest(member: PublicMember, listingId: string, input: { quantity?: unknown; offeredItemName?: unknown; offeredQuantity?: unknown; message?: unknown }) { const listing = await getItemListing(listingId); if (!listing || listing.status !== "active") throw new MemberAuthError("INVALID_INPUT", "현재 제안을 받을 수 없는 아이템 거래글입니다."); if (listing.ownerId === member.id) throw new MemberAuthError("FORBIDDEN", "본인의 아이템 거래글에는 제안할 수 없습니다."); const requestedQuantity = qty(input.quantity ?? listing.quantity, "거래 수량"); if (requestedQuantity > listing.quantity) throw new MemberAuthError("INVALID_INPUT", "등록 수량을 초과해 제안할 수 없습니다."); if (isRampageSoul(listing.itemName) && listing.priceCurrency === "boxes" && requestedQuantity % RAMPAGE_SOULS_PER_AUTO_HUNT_BOX !== 0) throw new MemberAuthError("INVALID_INPUT", `폭주의 혼 거래 수량은 ${RAMPAGE_SOULS_PER_AUTO_HUNT_BOX}개 단위로 제안해 주세요.`); const offeredItemName = listing.listingType === "exchange" ? shortText(input.offeredItemName, "제안 아이템") : null; const offeredQuantity = listing.listingType === "exchange" ? qty(input.offeredQuantity, "제안 수량") : null; const id = randomUUID(); await db().execute("INSERT INTO marketplace_item_requests (id,listing_id,owner_id,requester_id,requester_nickname,requester_game_nickname,requested_quantity,offered_item_name,offered_quantity,message) VALUES (?,?,?,?,?,?,?,?,?,?)", [id, listing.id, listing.ownerId, member.id, member.nickname, member.gameNickname, requestedQuantity, offeredItemName, offeredQuantity, optionalText(input.message)]); return { id, ownerId: listing.ownerId, requesterGameNickname: member.gameNickname, itemName: listing.itemName, requestedQuantity }; }
export async function cancelItemListing(ownerId: string, listingId: string) { const result = await db().execute("UPDATE marketplace_item_listings SET status='cancelled' WHERE id=? AND owner_id=? AND status='active'", [listingId, ownerId]); if (!affected(result)) throw new MemberAuthError("INVALID_INPUT", "거래 중인 내 아이템 글만 취소할 수 있습니다."); return { id: listingId, status: "cancelled" as const }; }
export async function respondItemRequest(memberId: string, requestId: string, action: "accept" | "reject" | "complete" | "cancel") {
  const result = await db().query(`SELECT ${requestColumns} FROM marketplace_item_requests WHERE id=? LIMIT 1`, [requestId]);
  const request = rows(result)[0];
  if (!request) throw new MemberAuthError("INVALID_INPUT", "아이템 거래 제안을 찾을 수 없습니다.");
  const isOwner = String(request.ownerId) === memberId;
  const isRequester = String(request.requesterId) === memberId;
  if ((action === "accept" || action === "reject" || action === "complete") && !isOwner) throw new MemberAuthError("FORBIDDEN", "거래글 작성자만 처리할 수 있습니다.");
  if (action === "cancel" && !isRequester) throw new MemberAuthError("FORBIDDEN", "제안한 회원만 취소할 수 있습니다.");
  const current = String(request.status);
  if (action === "accept" && current === "pending") {
    if (!affected(await db().execute("UPDATE marketplace_item_listings SET status='reserved', reserved_by_request_id=? WHERE id=? AND owner_id=? AND status='active'", [requestId, request.listingId, memberId]))) throw new MemberAuthError("INVALID_INPUT", "아이템 거래글이 이미 처리되었습니다.");
    await db().execute("UPDATE marketplace_item_requests SET status='accepted', responded_at=NOW() WHERE id=?", [requestId]);
    await db().execute("UPDATE marketplace_item_requests SET status='rejected', responded_at=NOW() WHERE listing_id=? AND id<>? AND status='pending'", [request.listingId, requestId]);
  } else if (action === "reject" && current === "pending") {
    await db().execute("UPDATE marketplace_item_requests SET status='rejected', responded_at=NOW() WHERE id=?", [requestId]);
  } else if (action === "cancel" && current === "pending") {
    await db().execute("UPDATE marketplace_item_requests SET status='cancelled', responded_at=NOW() WHERE id=?", [requestId]);
  } else if (action === "complete" && current === "accepted") {
    const listing = await getItemListing(String(request.listingId));
    await db().execute("UPDATE marketplace_item_listings SET status='completed' WHERE id=? AND owner_id=? AND reserved_by_request_id=?", [request.listingId, memberId, requestId]);
    await db().execute("UPDATE marketplace_item_requests SET status='completed' WHERE id=?", [requestId]);
    if (listing && listing.listingType !== "exchange" && listing.priceBoxes) {
      try {
        const [summary] = await getItemPriceSummaries([listing.itemName]);
        await recordMarketplacePriceDropAlert({
          targetType: "item",
          targetKey: listing.itemName,
          targetName: listing.itemName,
          baselineBoxesPerUnit: summary?.baselineBoxesPerUnit ?? null,
          recentAverageBoxesPerUnit: summary?.recentAverageBoxesPerUnit ?? null,
          source: "completed-item-trade",
        });
      } catch (error) {
        console.error("Failed to record marketplace item price alert:", error);
      }
    }
  } else throw new MemberAuthError("INVALID_INPUT", "처리할 수 없는 아이템 거래 제안 상태입니다.");
  return { id: requestId, action };
}
export async function getMyItemMarketplace(memberId: string) { const [listingResult, receivedResult, sentResult] = await Promise.all([db().query(`SELECT ${listingColumns} FROM marketplace_item_listings WHERE owner_id=? ORDER BY created_at DESC LIMIT 100`, [memberId]), db().query(`SELECT ${requestColumns} FROM marketplace_item_requests WHERE owner_id=? ORDER BY created_at DESC LIMIT 100`, [memberId]), db().query(`SELECT ${requestColumns} FROM marketplace_item_requests WHERE requester_id=? ORDER BY created_at DESC LIMIT 100`, [memberId])]); const listings = rows(listingResult).map(listingFrom); const listingById = new Map(listings.map((listing) => [listing.id, listing])); const attach = (row: Row) => { const request = requestFrom(row); return { ...request, listing: listingById.get(request.listingId) }; }; return { listings, received: rows(receivedResult).map(attach), sent: rows(sentResult).map(attach) }; }

export type ItemCatalogEntry = { id: string; name: string; imageUrl: string | null; baselineBoxesPerUnit: number | null; isActive: boolean; sortOrder: number; updatedAt: string };
export type ItemPriceSummary = { itemName: string; recentCompletedCount: number; recentAverageBoxesPerUnit: number | null; baselineBoxesPerUnit: number | null; displayBoxesPerUnit: number | null; source: "recent" | "baseline" | "unavailable" };
function catalogFrom(row: Row): ItemCatalogEntry { return { id: String(row.id), name: String(row.name), imageUrl: row.imageUrl ? String(row.imageUrl) : null, baselineBoxesPerUnit: row.baselineBoxesPerUnit === null ? null : Number(row.baselineBoxesPerUnit), isActive: Number(row.isActive) === 1, sortOrder: Number(row.sortOrder), updatedAt: time(row.updatedAt) }; }
export async function listItemCatalog(includeInactive = false) { const result = await db().query(`SELECT id,name,image_url AS imageUrl,baseline_boxes_per_unit AS baselineBoxesPerUnit,is_active AS isActive,sort_order AS sortOrder,updated_at AS updatedAt FROM marketplace_item_catalog ${includeInactive ? "" : "WHERE is_active=1"} ORDER BY sort_order,name`); return rows(result).map(catalogFrom); }
export async function saveItemCatalogEntry(administratorId: string, input: { id?: unknown; name: unknown; imageUrl?: unknown; baselineBoxesPerUnit?: unknown; isActive?: unknown; sortOrder?: unknown }) { const name = shortText(input.name, "아이템 이름"); const id = typeof input.id === "string" && /^[a-z0-9-]{2,64}$/.test(input.id) ? input.id : randomUUID(); const imageUrl = typeof input.imageUrl === "string" && input.imageUrl.trim() ? input.imageUrl.trim().slice(0, 500) : null; const baseline = input.baselineBoxesPerUnit === undefined || input.baselineBoxesPerUnit === null || input.baselineBoxesPerUnit === "" ? null : boxes(input.baselineBoxesPerUnit); const isActive = input.isActive === false || input.isActive === 0 || input.isActive === "0" ? 0 : 1; const sortOrder = Number.isInteger(Number(input.sortOrder)) ? Math.max(0, Math.min(9999, Number(input.sortOrder))) : 0; await db().execute("INSERT INTO marketplace_item_catalog (id,name,image_url,baseline_boxes_per_unit,is_active,sort_order,updated_by) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),image_url=VALUES(image_url),baseline_boxes_per_unit=VALUES(baseline_boxes_per_unit),is_active=VALUES(is_active),sort_order=VALUES(sort_order),updated_by=VALUES(updated_by)", [id, name, imageUrl, baseline, isActive, sortOrder, administratorId]); const result = await db().query("SELECT id,name,image_url AS imageUrl,baseline_boxes_per_unit AS baselineBoxesPerUnit,is_active AS isActive,sort_order AS sortOrder,updated_at AS updatedAt FROM marketplace_item_catalog WHERE id=?", [id]); const row = rows(result)[0]; if (!row) throw new MemberAuthError("SETUP_ERROR", "아이템을 저장하지 못했습니다."); return catalogFrom(row); }
export async function getItemPriceSummaries(itemNames: string[]) { const names = Array.from(new Set(itemNames.map((name) => name.trim()).filter(Boolean))).slice(0, 100); if (!names.length) return [] as ItemPriceSummary[]; const placeholders = names.map(() => "?").join(","); const [recentResult, baselineResult] = await Promise.all([db().query(`SELECT l.item_name AS itemName,COUNT(*) AS completedCount,SUM(l.price_boxes * r.requested_quantity / l.quantity) / SUM(r.requested_quantity) AS averageBoxes FROM marketplace_item_requests r INNER JOIN marketplace_item_listings l ON l.id=r.listing_id WHERE r.status='completed' AND l.listing_type IN ('sell','buy') AND r.updated_at>=DATE_SUB(NOW(), INTERVAL 14 DAY) AND l.item_name IN (${placeholders}) GROUP BY l.item_name`, names), db().query(`SELECT name AS itemName,baseline_boxes_per_unit AS baselineBoxes FROM marketplace_item_catalog WHERE name IN (${placeholders})`, names)]); const recent = new Map(rows(recentResult).map((row) => [String(row.itemName), row])); const baselines = new Map(rows(baselineResult).map((row) => [String(row.itemName), row])); return names.map((itemName) => { const recentRow = recent.get(itemName); const baselineRow = baselines.get(itemName); const recentAverageBoxesPerUnit = recentRow ? Math.round(Number(recentRow.averageBoxes)) : null; const baselineBoxesPerUnit = baselineRow?.baselineBoxes === null || !baselineRow ? null : Number(baselineRow.baselineBoxes); return { itemName, recentCompletedCount: recentRow ? Number(recentRow.completedCount) : 0, recentAverageBoxesPerUnit, baselineBoxesPerUnit, displayBoxesPerUnit: recentAverageBoxesPerUnit ?? baselineBoxesPerUnit, source: recentAverageBoxesPerUnit !== null ? "recent" : baselineBoxesPerUnit !== null ? "baseline" : "unavailable" }; }); }
