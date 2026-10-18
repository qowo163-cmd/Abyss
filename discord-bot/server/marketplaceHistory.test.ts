import { afterEach, describe, expect, it } from "vitest";
import { listMarketplaceHistory, setMarketplaceHistoryPoolForTesting } from "./marketplaceHistory";

describe("administrator marketplace history", () => {
  afterEach(() => setMarketplaceHistoryPoolForTesting(undefined));

  it("returns unified hench and item records with filter parameters", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];
    setMarketplaceHistoryPoolForTesting({
      async query(sql: string, params: unknown[] = []) {
        capturedSql = sql;
        capturedParams = params;
        return [[
          { id: "hench-1", recordKind: "listing", category: "hench", listingType: "sell", subjectName: "골든듀크", quantity: 2, priceAmount: 40, priceCurrency: "boxes", ownerNickname: "판매자", ownerGameNickname: "판매게임닉", counterpartNickname: "구매자", counterpartGameNickname: "구매게임닉", status: "completed", note: "완료", createdAt: new Date("2026-08-20T01:00:00.000Z"), updatedAt: new Date("2026-08-20T02:00:00.000Z") },
          { id: "item-1", recordKind: "request", category: "item", listingType: "buy", subjectName: "프리즘", quantity: 3, priceAmount: 30_000_000, priceCurrency: "gp", ownerNickname: "구매자", ownerGameNickname: "구매게임닉", counterpartNickname: null, counterpartGameNickname: null, status: "rejected", note: null, createdAt: new Date("2026-08-21T01:00:00.000Z"), updatedAt: new Date("2026-08-21T01:00:00.000Z") },
        ], []];
      },
    });

    const records = await listMarketplaceHistory({ category: "hench", listingType: "sell", status: "completed", query: "골든듀크", days: 30, limit: 50 });

    expect(capturedSql).toContain("marketplace_item_listings");
    expect(capturedSql).toContain("marketplace_exchange_listings");
    expect(capturedParams).toEqual(expect.arrayContaining(["hench", "sell", "completed", "%골든듀크%", 50]));
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "hench-listing-sell-hench-1", recordKind: "listing", category: "hench", subjectName: "골든듀크", priceCurrency: "boxes", status: "completed", counterpartNickname: "구매자" }),
      expect.objectContaining({ id: "item-request-buy-item-1", recordKind: "request", category: "item", subjectName: "프리즘", priceAmount: 30_000_000, priceCurrency: "gp", status: "rejected" }),
    ]));
  });

  it("uses safe defaults and limits the maximum number of returned records", async () => {
    let capturedParams: unknown[] = [];
    setMarketplaceHistoryPoolForTesting({
      async query(_sql: string, params: unknown[] = []) { capturedParams = params; return [[], []]; },
    });

    await expect(listMarketplaceHistory({ category: "invalid", listingType: "invalid", status: "invalid", days: 5, limit: 9_999 })).resolves.toEqual([]);

    expect(capturedParams).toEqual([500]);
  });
});
