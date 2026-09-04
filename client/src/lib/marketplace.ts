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

export interface MarketplaceExchangeOffer {
  id: string;
  exchangeListingId: string;
  ownerId: string;
  proposerId: string;
  proposerNickname: string;
  proposerGameNickname: string;
  offered: { monster: MarketplaceMonsterSnapshot; quantity: number };
  message: string | null;
  status: MarketplaceRequestStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceExchangeListing {
  id: string;
  ownerId: string;
  ownerNickname: string;
  ownerGameNickname: string;
  offered: { monster: MarketplaceMonsterSnapshot; quantity: number };
  wants: Array<{ monster: MarketplaceMonsterSnapshot; quantity: number }>;
  note: string | null;
  status: MarketplaceListingStatus;
  reservedByOfferId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceExchangeMine {
  listings: MarketplaceExchangeListing[];
  received: MarketplaceExchangeOffer[];
  sent: MarketplaceExchangeOffer[];
}

export interface MarketplacePriceSummary {
  monsterId: string;
  recentCompletedCount: number;
  recentAverageBoxesPerUnit: number | null;
  baselineBoxesPerUnit: number | null;
  displayBoxesPerUnit: number | null;
  source: "recent" | "baseline" | "unavailable";
}

export interface MarketplaceMine {
  listings: MarketplaceListing[];
  requests: {
    selling: MarketplaceTradeRequest[];
    buying: MarketplaceTradeRequest[];
  };
  buyOrders: MarketplaceBuyOrder[];
  saleOffers: {
    received: MarketplaceSaleOffer[];
    sent: MarketplaceSaleOffer[];
  };
}

async function marketplaceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    ...init,
  });
  const payload = await response.json().catch(() => null) as T & { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message || "거래소 요청을 처리하지 못했습니다.");
  return payload as T;
}

export type MarketplaceTab = "sell" | "buy" | "exchange" | "items";
export interface MarketplaceTabSettings {
  sellEnabled: boolean;
  buyEnabled: boolean;
  exchangeEnabled: boolean;
  itemsEnabled: boolean;
  updatedAt: string | null;
}

export function getMarketplaceTabSettings() {
  return marketplaceFetch<{ settings: MarketplaceTabSettings }>("/api/marketplace/tab-settings");
}

export function getAdminMarketplaceTabSettings() {
  return marketplaceFetch<{ settings: MarketplaceTabSettings }>("/api/admin/marketplace/tab-settings");
}

export function saveAdminMarketplaceTabSettings(settings: Pick<MarketplaceTabSettings, "sellEnabled" | "buyEnabled" | "exchangeEnabled" | "itemsEnabled">) {
  return marketplaceFetch<{ settings: MarketplaceTabSettings }>("/api/admin/marketplace/tab-settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function getMarketplaceListings(query = "") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  return marketplaceFetch<{ listings: MarketplaceListing[] }>(`/api/marketplace/listings${params.size ? `?${params}` : ""}`);
}

export function getMarketplacePriceSummaries(monsterIds: string[]) {
  const ids = monsterIds.filter(Boolean).slice(0, 100);
  if (ids.length === 0) return Promise.resolve({ prices: [] as MarketplacePriceSummary[] });
  const params = new URLSearchParams({ ids: ids.join(",") });
  return marketplaceFetch<{ prices: MarketplacePriceSummary[] }>(`/api/marketplace/price-summaries?${params}`);
}

export function getMyMarketplace() {
  return marketplaceFetch<MarketplaceMine>("/api/marketplace/mine");
}

export function getMyMarketplaceExchanges() {
  return marketplaceFetch<MarketplaceExchangeMine>("/api/marketplace/exchanges/mine");
}

export function cancelMarketplaceExchangeListing(listingId: string) {
  return marketplaceFetch<{ listing: Pick<MarketplaceExchangeListing, "id" | "status"> }>(`/api/marketplace/exchanges/${listingId}/cancel`, { method: "PATCH" });
}

export function updateMarketplaceExchangeOffer(offerId: string, action: "accept" | "reject" | "cancel" | "complete") {
  return marketplaceFetch<{ offer: { id: string; action: string } }>(`/api/marketplace/exchange-offers/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export function postMarketplaceListing(input: { monsterId: string; quantity: number; priceBoxes?: number; unitPriceBoxes?: number; note?: string }) {
  return marketplaceFetch<{ listing: MarketplaceListing }>("/api/marketplace/listings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelMarketplaceListing(listingId: string) {
  return marketplaceFetch<{ listing: MarketplaceListing }>(`/api/marketplace/listings/${listingId}/cancel`, { method: "PATCH" });
}

export function postMarketplaceRequest(listingId: string, quantity: number, message?: string) {
  return marketplaceFetch<{ request: MarketplaceTradeRequest }>(`/api/marketplace/listings/${listingId}/requests`, {
    method: "POST",
    body: JSON.stringify({ quantity, message }),
  });
}

export function updateMarketplaceRequest(requestId: string, action: "accept" | "reject" | "cancel" | "complete") {
  return marketplaceFetch<{ request: MarketplaceTradeRequest }>(`/api/marketplace/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export async function getMarketplaceBuyOrders(query = "") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  return marketplaceFetch<{ buyOrders: MarketplaceBuyOrder[] }>(`/api/marketplace/buy-orders${params.size ? `?${params}` : ""}`);
}

export function postMarketplaceBuyOrder(input: { monsterId: string; quantity: number; offerBoxes?: number; unitOfferBoxes?: number; note?: string }) {
  return marketplaceFetch<{ buyOrder: MarketplaceBuyOrder }>("/api/marketplace/buy-orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelMarketplaceBuyOrder(buyOrderId: string) {
  return marketplaceFetch<{ buyOrder: MarketplaceBuyOrder }>(`/api/marketplace/buy-orders/${buyOrderId}/cancel`, { method: "PATCH" });
}

export function postMarketplaceSaleOffer(buyOrderId: string, quantity: number, message?: string) {
  return marketplaceFetch<{ offer: MarketplaceSaleOffer }>(`/api/marketplace/buy-orders/${buyOrderId}/sale-offers`, {
    method: "POST",
    body: JSON.stringify({ quantity, message }),
  });
}

export function updateMarketplaceSaleOffer(offerId: string, action: "accept" | "reject" | "cancel" | "complete") {
  return marketplaceFetch<{ offer: MarketplaceSaleOffer }>(`/api/marketplace/sale-offers/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export type MarketplaceItemListingType = "sell" | "buy" | "exchange";
export type MarketplaceItemListingStatus = "active" | "reserved" | "completed" | "cancelled";
export interface MarketplaceItemWant { name: string; quantity: number; }
export interface MarketplaceItemListing {
  id: string;
  ownerId: string;
  ownerNickname: string;
  ownerGameNickname: string;
  listingType: MarketplaceItemListingType;
  itemName: string;
  quantity: number;
  priceBoxes: number | null;
  priceCurrency: "boxes" | "gp";
  wantedItems: MarketplaceItemWant[];
  note: string | null;
  status: MarketplaceItemListingStatus;
  reservedByRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MarketplaceItemRequest {
  id: string;
  listingId: string;
  ownerId: string;
  requesterId: string;
  requesterNickname: string;
  requesterGameNickname: string;
  requestedQuantity: number;
  offeredItemName: string | null;
  offeredQuantity: number | null;
  message: string | null;
  status: MarketplaceRequestStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: MarketplaceItemListing;
}
export interface MarketplaceItemMine { listings: MarketplaceItemListing[]; received: MarketplaceItemRequest[]; sent: MarketplaceItemRequest[]; }

export async function getMarketplaceItemListings(query = "", type?: MarketplaceItemListingType) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  if (type) params.set("type", type);
  return marketplaceFetch<{ listings: MarketplaceItemListing[] }>(`/api/marketplace/items${params.size ? `?${params}` : ""}`);
}
export function getMyMarketplaceItems() { return marketplaceFetch<MarketplaceItemMine>("/api/marketplace/items/mine"); }
export function postMarketplaceItemListing(input: { listingType: MarketplaceItemListingType; itemName: string; quantity: number; priceBoxes?: number; unitPrice?: number; priceCurrency?: "boxes" | "gp"; wantedItems?: MarketplaceItemWant[]; note?: string }) {
  return marketplaceFetch<{ listing: MarketplaceItemListing }>("/api/marketplace/items", { method: "POST", body: JSON.stringify(input) });
}
export function cancelMarketplaceItemListing(listingId: string) { return marketplaceFetch<{ listing: MarketplaceItemListing }>(`/api/marketplace/items/${listingId}/cancel`, { method: "PATCH" }); }
export function postMarketplaceItemRequest(listingId: string, input: { quantity: number; offeredItemName?: string; offeredQuantity?: number; message?: string }) {
  return marketplaceFetch<{ request: MarketplaceItemRequest }>(`/api/marketplace/items/${listingId}/requests`, { method: "POST", body: JSON.stringify(input) });
}
export function updateMarketplaceItemRequest(requestId: string, action: "accept" | "reject" | "cancel" | "complete") {
  return marketplaceFetch<{ request: MarketplaceItemRequest }>(`/api/marketplace/item-requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ action }) });
}

export interface MarketplaceItemPriceSummary { itemName: string; recentCompletedCount: number; recentAverageBoxesPerUnit: number | null; baselineBoxesPerUnit: number | null; displayBoxesPerUnit: number | null; source: "recent" | "baseline" | "unavailable"; }
export function getMarketplaceItemPriceSummaries(itemNames: string[]) {
  const names = itemNames.filter(Boolean).slice(0, 100);
  if (!names.length) return Promise.resolve({ prices: [] as MarketplaceItemPriceSummary[] });
  return marketplaceFetch<{ prices: MarketplaceItemPriceSummary[] }>(`/api/marketplace/items/price-summaries?names=${encodeURIComponent(names.join(","))}`);
}

export type MarketplaceHistoryCategory = "all" | "hench" | "item";
export type MarketplaceHistoryType = "all" | "sell" | "buy" | "exchange";
export type MarketplaceHistoryStatus = "all" | MarketplaceItemListingStatus | "pending" | "accepted" | "rejected";
export interface MarketplaceHistoryEntry {
  id: string;
  recordKind: "listing" | "request";
  category: Exclude<MarketplaceHistoryCategory, "all">;
  listingType: Exclude<MarketplaceHistoryType, "all">;
  subjectName: string;
  quantity: number;
  priceAmount: number | null;
  priceCurrency: "boxes" | "gp" | "exchange";
  ownerNickname: string;
  ownerGameNickname: string;
  counterpartNickname: string | null;
  counterpartGameNickname: string | null;
  status: Exclude<MarketplaceHistoryStatus, "all">;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MarketplaceHistoryFilters {
  category?: MarketplaceHistoryCategory;
  listingType?: MarketplaceHistoryType;
  status?: MarketplaceHistoryStatus;
  query?: string;
  days?: "all" | "7" | "30" | "90";
  limit?: number;
}
export function getAdminMarketplaceHistory(filters: MarketplaceHistoryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.listingType && filters.listingType !== "all") params.set("listingType", filters.listingType);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.query?.trim()) params.set("query", filters.query.trim());
  if (filters.days && filters.days !== "all") params.set("days", filters.days);
  params.set("limit", String(filters.limit || 200));
  return marketplaceFetch<{ records: MarketplaceHistoryEntry[] }>(`/api/marketplace/admin/history?${params.toString()}`);
}
