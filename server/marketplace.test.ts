import { afterEach, describe, expect, it } from "vitest";
import type { PublicMember } from "./memberAuth";
import {
  createMarketplaceBuyOrder,
  createMarketplaceListing,
  createMarketplaceTradeRequest,
  completeMarketplaceTrade,
  getMarketplacePriceSummaries,
  respondToMarketplaceTradeRequest,
  setMarketplacePoolForTesting,
  syncMarketplaceMonsterSnapshot,
} from "./marketplace";
import { setMarketplaceTabSettingsPoolForTesting } from "./marketplaceSettings";

type ListingRow = Record<string, unknown>;
type RequestRow = Record<string, unknown>;
type BuyOrderRow = Record<string, unknown>;

const seller: PublicMember = {
  id: "seller-1", username: "seller", nickname: "판매자", discordNickname: "seller-discord", gameNickname: "판매게임닉",
  role: "admin", status: "approved", approvedAt: new Date().toISOString(), lastActivityAt: null, createdAt: new Date().toISOString(),
};

const buyer: PublicMember = {
  id: "buyer-1", username: "buyer", nickname: "구매자", discordNickname: "buyer-discord", gameNickname: "구매게임닉",
  role: "member", status: "approved", approvedAt: new Date().toISOString(), lastActivityAt: null, createdAt: new Date().toISOString(),
};

function buildPool(baselineBoxesPerUnit: number | null = null) {
  const listings = new Map<string, ListingRow>();
  const requests = new Map<string, RequestRow>();
  const buyOrders = new Map<string, BuyOrderRow>();
  const listingRow = (listing: ListingRow) => listing;
  const requestRow = (request: RequestRow) => {
    const listing = listings.get(String(request.listingId));
    return {
      ...request,
      monsterId: listing?.monsterId,
      monsterName: listing?.monsterName,
      monsterAttribute: listing?.monsterAttribute,
      monsterType: listing?.monsterType,
      monsterLevel: listing?.monsterLevel,
      quantity: listing?.quantity,
      priceBoxes: listing?.priceBoxes,
      listingSellerNickname: listing?.sellerNickname,
      listingSellerGameNickname: listing?.sellerGameNickname,
      listingStatus: listing?.status,
    };
  };
  const pool = {
    async query(sql: string, values: unknown[] = []) {
      if (sql.includes("FROM (")) return [[], []];
      if (sql.includes("marketplace_price_baselines")) {
        return [baselineBoxesPerUnit === null ? [] : [{ monsterId: String(values[0]), boxesPerUnit: baselineBoxesPerUnit }], []];
      }
      if (sql.includes("FROM marketplace_listings WHERE id")) {
        const item = listings.get(String(values[0]));
        return [item ? [listingRow(item)] : [], []];
      }
      if (sql.includes("FROM marketplace_buy_orders WHERE id")) {
        const item = buyOrders.get(String(values[0]));
        return [item ? [item] : [], []];
      }
      if (sql.includes("SELECT id FROM marketplace_trade_requests")) return [[], []];
      if (sql.includes("FROM marketplace_trade_requests r INNER JOIN marketplace_listings l") && sql.includes("WHERE r.id")) {
        const item = requests.get(String(values[0]));
        return [item ? [requestRow(item)] : [], []];
      }
      throw new Error(`Unhandled query: ${sql}`);
    },
    async execute(sql: string, values: unknown[] = []) {
      if (sql.includes("INSERT INTO marketplace_listings")) {
        const [id, sellerId, sellerNickname, sellerGameNickname, monsterId, monsterName, monsterAttribute, monsterType, monsterLevel, quantity, priceBoxes, note] = values;
        listings.set(String(id), { id, sellerId, sellerNickname, sellerGameNickname, monsterId, monsterName, monsterAttribute, monsterType, monsterLevel, quantity, priceBoxes, note, status: "active", reservedByRequestId: null, createdAt: new Date(), updatedAt: new Date() });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("INSERT INTO marketplace_buy_orders")) {
        const [id, buyerId, buyerNickname, buyerGameNickname, monsterId, monsterName, monsterAttribute, monsterType, monsterLevel, quantity, offerBoxes, note] = values;
        buyOrders.set(String(id), { id, buyerId, buyerNickname, buyerGameNickname, monsterId, monsterName, monsterAttribute, monsterType, monsterLevel, quantity, offerBoxes, note, status: "active", reservedByOfferId: null, createdAt: new Date(), updatedAt: new Date() });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("INSERT INTO marketplace_trade_requests")) {
        const [id, listingId, sellerId, buyerId, buyerNickname, buyerGameNickname, requestedQuantity, requestedPriceBoxes, message] = values;
        requests.set(String(id), { id, listingId, sellerId, buyerId, buyerNickname, buyerGameNickname, requestedQuantity, requestedPriceBoxes, message, status: "pending", respondedAt: null, createdAt: new Date(), updatedAt: new Date() });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE marketplace_listings SET status = 'reserved'")) {
        const listing = listings.get(String(values[1]));
        if (!listing || listing.status !== "active") return [{ affectedRows: 0 }, []];
        listing.status = "reserved";
        listing.reservedByRequestId = values[0];
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE marketplace_trade_requests SET status = 'accepted'")) {
        const request = requests.get(String(values[0]));
        if (!request || request.status !== "pending") return [{ affectedRows: 0 }, []];
        request.status = "accepted";
        request.respondedAt = new Date();
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE marketplace_trade_requests SET status = 'rejected'") && sql.includes("WHERE id = ?")) {
        const request = requests.get(String(values[0]));
        if (!request || request.status !== "pending") return [{ affectedRows: 0 }, []];
        request.status = "rejected";
        request.respondedAt = new Date();
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE marketplace_trade_requests SET status = 'rejected'")) return [{ affectedRows: 1 }, []];
      if (sql.includes("UPDATE marketplace_listings") && sql.includes("SET quantity = quantity -")) {
        const [requestedQuantity, requestedPriceBoxes, , listingId, sellerId, requestId] = values;
        const listing = listings.get(String(listingId));
        if (!listing || listing.sellerId !== sellerId || listing.status !== "reserved" || listing.reservedByRequestId !== requestId) return [{ affectedRows: 0 }, []];
        listing.quantity = Number(listing.quantity) - Number(requestedQuantity);
        listing.priceBoxes = Number(listing.priceBoxes) - Number(requestedPriceBoxes);
        listing.status = Number(listing.quantity) === 0 ? "completed" : "active";
        listing.reservedByRequestId = null;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE marketplace_trade_requests SET status = 'completed'")) {
        const request = requests.get(String(values[0]));
        if (!request || request.status !== "accepted") return [{ affectedRows: 0 }, []];
        request.status = "completed";
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE marketplace_listings SET status = 'active'")) return [{ affectedRows: 1 }, []];
      throw new Error(`Unhandled execute: ${sql}`);
    },
  };
  return { pool, listings, requests, buyOrders };
}

describe("marketplace storage", () => {
  it("updates existing sale and purchase snapshots when a hench is edited", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    setMarketplacePoolForTesting({
      async query() { return [[], []] as never; },
      async execute(sql: string, values: unknown[] = []) {
        statements.push({ sql, values });
        return [{ affectedRows: 1 }, []] as never;
      },
    });

    await syncMarketplaceMonsterSnapshot({ id: "hench-1", name: "최신 루루삐", attribute: "드래곤", type: "장코", level: "216" });

    expect(statements).toHaveLength(2);
    expect(statements.map(({ sql }) => sql).join("\\n")).toContain("UPDATE marketplace_listings SET monster_name=?");
    expect(statements.map(({ sql }) => sql).join("\\n")).toContain("UPDATE marketplace_buy_orders SET monster_name=?");
    expect(statements[0]?.values).toEqual(["최신 루루삐", "드래곤", "장코", "216", "hench-1"]);
  });
  afterEach(() => {
    setMarketplacePoolForTesting(undefined);
    setMarketplaceTabSettingsPoolForTesting(undefined);
  });

  it("stores a selected hench with seller identity, quantity, and automatic-hunting-box price", async () => {
    const { pool } = buildPool();
    setMarketplacePoolForTesting(pool as never);

    const listing = await createMarketplaceListing(seller, {
      monster: { id: "hench-1", name: "루루삐", attribute: "미스터리", type: "장코", level: "208 ~ 233" },
      quantity: 3,
      priceBoxes: 51,
      note: "저녁 거래 가능",
    });

    expect(listing).toMatchObject({
      sellerId: seller.id,
      sellerGameNickname: seller.gameNickname,
      monster: { id: "hench-1", name: "루루삐", attribute: "미스터리" },
      quantity: 3,
      priceBoxes: 51,
      status: "active",
    });
  });

  it("converts per-hench sale and purchase prices into bundle totals", async () => {
    const { pool } = buildPool();
    setMarketplacePoolForTesting(pool as never);
    const monster = { id: "hench-1", name: "루루삐", attribute: null, type: null, level: null };

    await expect(createMarketplaceListing(seller, { monster, quantity: 2, unitPriceBoxes: 8 })).resolves.toMatchObject({ quantity: 2, priceBoxes: 16 });
    await expect(createMarketplaceBuyOrder(seller, { monster, quantity: 3, unitOfferBoxes: 8 })).resolves.toMatchObject({ quantity: 3, offerBoxes: 24 });
  });

  it("rejects invalid quantity before creating a listing", async () => {
    await expect(createMarketplaceListing(seller, {
      monster: { id: "hench-1", name: "루루삐", attribute: null, type: null, level: null },
      quantity: 0,
      priceBoxes: 10,
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("blocks hench sale and purchase listings below half of the current average price", async () => {
    const { pool } = buildPool(100);
    setMarketplacePoolForTesting(pool as never);
    const monster = { id: "hench-1", name: "루루삐", attribute: null, type: null, level: null };

    await expect(createMarketplaceListing(seller, { monster, quantity: 1, priceBoxes: 49 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createMarketplaceBuyOrder(seller, { monster, quantity: 1, offerBoxes: 49 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createMarketplaceListing(seller, { monster, quantity: 1, priceBoxes: 50 })).resolves.toMatchObject({ priceBoxes: 50 });
  });

  it("allows approved regular members to create sale and purchase registration posts after opening", async () => {
    const { pool } = buildPool();
    setMarketplacePoolForTesting(pool as never);
    setMarketplaceTabSettingsPoolForTesting({ query: async () => [[], []], execute: async () => [[], []] } as never);
    const monster = { id: "hench-1", name: "루루삐", attribute: null, type: null, level: null };

    await expect(createMarketplaceListing(buyer, { monster, quantity: 1, priceBoxes: 10 })).resolves.toMatchObject({ sellerId: buyer.id, status: "active" });
    await expect(createMarketplaceBuyOrder(buyer, { monster, quantity: 1, offerBoxes: 10 })).resolves.toMatchObject({ buyerId: buyer.id, status: "active" });
  });

  it("stores a selected hench as an administrator purchase order with the offered box price", async () => {
    const { pool } = buildPool();
    setMarketplacePoolForTesting(pool as never);

    const buyOrder = await createMarketplaceBuyOrder(seller, {
      monster: { id: "hench-1", name: "루루삐", attribute: "미스터리", type: "장코", level: "208 ~ 233" },
      quantity: 2,
      offerBoxes: 46,
      note: "오늘 거래 희망",
    });

    expect(buyOrder).toMatchObject({ buyerId: seller.id, monster: { id: "hench-1", name: "루루삐" }, quantity: 2, offerBoxes: 46, status: "active" });
  });

  it("uses the recent two-week completed-trade average before the initial price-sheet baseline", async () => {
    const queries: string[] = [];
    setMarketplacePoolForTesting({
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes("FROM (")) {
          return [[{ monsterId: "hench-1", recentCompletedCount: 3, recentAverageBoxesPerUnit: 28 }], []] as never;
        }
        if (sql.includes("marketplace_price_baselines")) {
          return [[{ monsterId: "hench-1", boxesPerUnit: 20 }, { monsterId: "hench-2", boxesPerUnit: 40 }], []] as never;
        }
        throw new Error(`Unhandled query: ${sql}`);
      },
      async execute() { return [{ affectedRows: 0 }, []] as never; },
    });

    const summaries = await getMarketplacePriceSummaries(["hench-1", "hench-2", "unknown"]);

    expect(summaries).toEqual([
      expect.objectContaining({ monsterId: "hench-1", recentCompletedCount: 3, displayBoxesPerUnit: 28, source: "recent" }),
      expect.objectContaining({ monsterId: "hench-2", recentCompletedCount: 0, displayBoxesPerUnit: 40, source: "baseline" }),
      expect.objectContaining({ monsterId: "unknown", recentCompletedCount: 0, displayBoxesPerUnit: null, source: "unavailable" }),
    ]);
    expect(queries.join("\n")).toContain("r.requested_price_boxes AS totalBoxes");
    expect(queries.join("\n")).toContain("o.offered_price_boxes AS totalBoxes");
  });

  it("blocks self-requests and reserves the listing only when the seller accepts a pending buyer request", async () => {
    const { pool, listings, requests } = buildPool();
    const listingId = "listing-1";
    listings.set(listingId, {
      id: listingId, sellerId: seller.id, sellerNickname: seller.nickname, sellerGameNickname: seller.gameNickname,
      monsterId: "hench-1", monsterName: "루루삐", monsterAttribute: "미스터리", monsterType: "장코", monsterLevel: "208 ~ 233",
      quantity: 2, priceBoxes: 30, note: null, status: "active", reservedByRequestId: null, createdAt: new Date(), updatedAt: new Date(),
    });
    setMarketplacePoolForTesting(pool as never);

    await expect(createMarketplaceTradeRequest(seller, listingId, {})).rejects.toMatchObject({ code: "FORBIDDEN" });

    const requestId = "request-1";
    requests.set(requestId, {
      id: requestId, listingId, sellerId: seller.id, buyerId: buyer.id, buyerNickname: buyer.nickname, buyerGameNickname: buyer.gameNickname,
      requestedQuantity: 2, requestedPriceBoxes: 30, message: "구매할게요", status: "pending", respondedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const request = await respondToMarketplaceTradeRequest(seller.id, requestId, "accept");

    expect(request.status).toBe("accepted");
    expect(request.listing.status).toBe("reserved");
    expect(listings.get(listingId)?.reservedByRequestId).toBe(requestId);
  });

  it("marks a received trade request as rejected when the seller declines it", async () => {
    const { pool, listings, requests } = buildPool();
    const listingId = "listing-reject";
    const requestId = "request-reject";
    listings.set(listingId, { id: listingId, sellerId: seller.id, sellerNickname: seller.nickname, sellerGameNickname: seller.gameNickname, monsterId: "hench-1", monsterName: "루루삐", monsterAttribute: null, monsterType: null, monsterLevel: null, quantity: 1, priceBoxes: 15, note: null, status: "active", reservedByRequestId: null, createdAt: new Date(), updatedAt: new Date() });
    requests.set(requestId, { id: requestId, listingId, sellerId: seller.id, buyerId: buyer.id, buyerNickname: buyer.nickname, buyerGameNickname: buyer.gameNickname, requestedQuantity: 1, requestedPriceBoxes: 15, message: null, status: "pending", respondedAt: null, createdAt: new Date(), updatedAt: new Date() });
    setMarketplacePoolForTesting(pool as never);

    const request = await respondToMarketplaceTradeRequest(seller.id, requestId, "reject");

    expect(request.status).toBe("rejected");
    expect(requests.get(requestId)?.status).toBe("rejected");
  });

  it("stores the selected partial quantity at the per-hench price and restores the remaining listing after completion", async () => {
    const { pool, listings } = buildPool();
    const listingId = "listing-partial";
    listings.set(listingId, {
      id: listingId, sellerId: seller.id, sellerNickname: seller.nickname, sellerGameNickname: seller.gameNickname,
      monsterId: "hench-1", monsterName: "로엘", monsterAttribute: null, monsterType: null, monsterLevel: null,
      quantity: 2, priceBoxes: 16, note: null, status: "active", reservedByRequestId: null, createdAt: new Date(), updatedAt: new Date(),
    });
    setMarketplacePoolForTesting(pool as never);

    const request = await createMarketplaceTradeRequest(buyer, listingId, { requestedQuantity: 1, message: "한 마리만 구매합니다." });
    expect(request).toMatchObject({ requestedQuantity: 1, requestedPriceBoxes: 8, status: "pending" });

    await respondToMarketplaceTradeRequest(seller.id, request.id, "accept");
    const completed = await completeMarketplaceTrade(seller.id, request.id);

    expect(completed.status).toBe("completed");
    expect(listings.get(listingId)).toMatchObject({ quantity: 1, priceBoxes: 8, status: "active", reservedByRequestId: null });
  });
});
