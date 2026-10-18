import { findMarketplaceItem, MARKETPLACE_ITEMS } from "./marketplaceItems";
import { describe, expect, it } from "vitest";
import { getMarketplaceGpPricingRule } from "@shared/marketplaceGpPricing";

describe("marketplace item catalog", () => {
  it("registers every user-provided item with a protected web storage image", () => {
    expect(MARKETPLACE_ITEMS).toHaveLength(29);
    expect(MARKETPLACE_ITEMS.map((item) => item.name)).toEqual(expect.arrayContaining(["1억GP", "40배세트", "곤충3차", "자동사냥박스", "어비스티켓", "분노곤충혼", "폭주드래곤혼", "프리즘"]));
    expect(MARKETPLACE_ITEMS.every((item) => item.imageUrl.startsWith("/manus-storage/"))).toBe(true);
    expect(findMarketplaceItem("40배세트")?.imageUrl).toContain("boost-set-40x_0ff5f0ea");
    expect(findMarketplaceItem("프리즘")?.imageUrl).toContain("prism_048dea0e");
  });

  it("resolves catalog icons even when spacing differs in a listing name", () => {
    expect(findMarketplaceItem("곤충 3차")?.id).toBe("insect-third");
    expect(findMarketplaceItem("자동사냥박스")?.imageUrl).toContain("auto-hunt-box");
  });

  it("assigns the requested GP unit to every rage soul, rampage soul, and prism", () => {
    const rageSouls = MARKETPLACE_ITEMS.filter((item) => item.id.startsWith("rage-"));
    const rampageSouls = MARKETPLACE_ITEMS.filter((item) => item.id.startsWith("rampage-"));

    expect(rageSouls).toHaveLength(8);
    expect(rampageSouls).toHaveLength(8);
    expect(rageSouls.every((item) => getMarketplaceGpPricingRule(item.name)?.unitGp === 10_000_000)).toBe(true);
    expect(rampageSouls.every((item) => getMarketplaceGpPricingRule(item.name)?.unitGp === 100_000_000)).toBe(true);
    expect(getMarketplaceGpPricingRule("프리즘")?.unitGp).toBe(10_000_000);
  });
});
