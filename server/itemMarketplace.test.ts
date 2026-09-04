import { afterEach, describe, expect, it } from "vitest";
import type { PublicMember } from "./memberAuth";
import { createItemListing, createItemRequest, setItemMarketplacePoolForTesting } from "./itemMarketplace";

const member: PublicMember = {
  id: "item-seller",
  username: "item_seller",
  nickname: "아이템판매자",
  discordNickname: "item-seller-discord",
  gameNickname: "아이템게임닉",
  role: "admin",
  status: "approved",
  approvedAt: new Date().toISOString(),
  lastActivityAt: null,
  createdAt: new Date().toISOString(),
};

function createItemPool(recentAverage: number | null = null) {
  const listings = new Map<string, Record<string, unknown>>();
  return {
    listings,
    pool: {
      async query(sql: string, values: unknown[] = []) {
        if (sql.includes("SUM(l.price_boxes")) {
          return [recentAverage === null ? [] : [{ averagePrice: recentAverage }], []];
        }
        if (sql.includes("baseline_boxes_per_unit AS baselinePrice")) return [[], []];
        if (sql.includes("FROM marketplace_item_listings WHERE id = ?")) {
          const listing = listings.get(String(values[0]));
          return [listing ? [listing] : [], []];
        }
        throw new Error(`Unhandled query: ${sql}`);
      },
      async execute(sql: string, values: unknown[] = []) {
        if (sql.includes("INSERT INTO marketplace_item_listings")) {
          const [id, ownerId, ownerNickname, ownerGameNickname, listingType, itemName, quantity, priceBoxes, priceCurrency, wantedItems, note] = values;
          listings.set(String(id), { id, ownerId, ownerNickname, ownerGameNickname, listingType, itemName, quantity, priceBoxes, priceCurrency, wantedItems, note, status: "active", reservedByRequestId: null, createdAt: new Date(), updatedAt: new Date() });
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`Unhandled execute: ${sql}`);
      },
    },
  };
}

describe("item marketplace GP price rules", () => {
  afterEach(() => setItemMarketplacePoolForTesting(undefined));

  it("stores rage souls and prism in 1천만 GP units, and rampage souls in 1억 GP units", async () => {
    const { pool } = createItemPool();
    setItemMarketplacePoolForTesting(pool as never);

    const [rage, prism, rampage] = await Promise.all([
      createItemListing(member, { listingType: "sell", itemName: "분노곤충혼", quantity: 1, priceBoxes: 150_000_000 }),
      createItemListing(member, { listingType: "buy", itemName: "프리즘", quantity: 2, priceBoxes: 20_000_000 }),
      createItemListing(member, { listingType: "sell", itemName: "폭주드래곤혼", quantity: 1, priceBoxes: 1_500_000_000 }),
    ]);

    expect(rage).toMatchObject({ itemName: "분노곤충혼", priceBoxes: 150_000_000, priceCurrency: "gp" });
    expect(prism).toMatchObject({ itemName: "프리즘", priceBoxes: 20_000_000, priceCurrency: "gp" });
    expect(rampage).toMatchObject({ itemName: "폭주드래곤혼", priceBoxes: 1_500_000_000, priceCurrency: "gp" });
  });

  it("rejects GP values that do not follow each item's required unit", async () => {
    const { pool } = createItemPool();
    setItemMarketplacePoolForTesting(pool as never);

    await expect(createItemListing(member, { listingType: "sell", itemName: "분노메탈혼", quantity: 1, priceBoxes: 15_000_000 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createItemListing(member, { listingType: "sell", itemName: "프리즘", quantity: 1, priceBoxes: 150_000_000 })).resolves.toMatchObject({ priceCurrency: "gp" });
    await expect(createItemListing(member, { listingType: "sell", itemName: "폭주새혼", quantity: 1, priceBoxes: 10_000_000 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("allows every item to choose boxes or GP while applying its special GP unit when GP is selected", async () => {
    const { pool } = createItemPool();
    setItemMarketplacePoolForTesting(pool as never);

    const boxesListing = await createItemListing(member, { listingType: "sell", itemName: "40배세트", quantity: 1, priceBoxes: 50, priceCurrency: "boxes" });
    const gpListing = await createItemListing(member, { listingType: "buy", itemName: "40배세트", quantity: 1, priceBoxes: 1_500_000_000, priceCurrency: "gp" });

    expect(boxesListing).toMatchObject({ itemName: "40배세트", priceBoxes: 50, priceCurrency: "boxes" });
    expect(gpListing).toMatchObject({ itemName: "40배세트", priceBoxes: 1_500_000_000, priceCurrency: "gp" });
    await expect(createItemListing(member, { listingType: "sell", itemName: "분노곤충혼", quantity: 1, priceBoxes: 10, priceCurrency: "boxes" })).resolves.toMatchObject({ priceBoxes: 10, priceCurrency: "boxes" });
  });

  it("converts per-item box and GP prices into stored bundle totals", async () => {
    const { pool } = createItemPool();
    setItemMarketplacePoolForTesting(pool as never);

    await expect(createItemListing(member, { listingType: "sell", itemName: "40배세트", quantity: 3, unitPrice: 8, priceCurrency: "boxes" })).resolves.toMatchObject({ quantity: 3, priceBoxes: 24, priceCurrency: "boxes" });
    await expect(createItemListing(member, { listingType: "buy", itemName: "40배세트", quantity: 2, unitPrice: 1_000_000_000, priceCurrency: "gp" })).resolves.toMatchObject({ quantity: 2, priceBoxes: 2_000_000_000, priceCurrency: "gp" });
  });

  it("blocks an item listing below half of its current same-currency average price", async () => {
    const { pool } = createItemPool(100);
    setItemMarketplacePoolForTesting(pool as never);

    await expect(createItemListing(member, { listingType: "sell", itemName: "40배세트", quantity: 1, priceBoxes: 49, priceCurrency: "boxes" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createItemListing(member, { listingType: "sell", itemName: "40배세트", quantity: 1, priceBoxes: 50, priceCurrency: "boxes" })).resolves.toMatchObject({ priceBoxes: 50 });
  });

  it("enforces two rampage souls per auto-hunt box for listings and item requests", async () => {
    const { pool } = createItemPool();
    setItemMarketplacePoolForTesting(pool as never);
    const listing = await createItemListing(member, { listingType: "sell", itemName: "폭주드래곤혼", quantity: 4, priceBoxes: 2, priceCurrency: "boxes" });

    await expect(createItemListing(member, { listingType: "sell", itemName: "폭주드래곤혼", quantity: 3, priceBoxes: 2, priceCurrency: "boxes" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createItemListing(member, { listingType: "sell", itemName: "폭주드래곤혼", quantity: 4, priceBoxes: 3, priceCurrency: "boxes" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createItemRequest({ ...member, id: "item-buyer" }, listing.id, { quantity: 1 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
