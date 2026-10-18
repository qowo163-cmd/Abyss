import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKETPLACE_GP_PRICING_RULE,
  getMarketplaceGpPricingRule,
  gpAmountFromUnitCount,
  isValidGpAmountForRule,
} from "./marketplaceGpPricing";

describe("marketplace GP pricing rules", () => {
  it("uses 1억 GP units as the standard rule when a normal item is set to GP", () => {
    expect(DEFAULT_MARKETPLACE_GP_PRICING_RULE).toMatchObject({ inputUnitLabel: "억", unitGp: 100_000_000, maxInput: 1_000 });
    expect(gpAmountFromUnitCount(15, DEFAULT_MARKETPLACE_GP_PRICING_RULE)).toBe(1_500_000_000);
  });

  it("assigns 1천만 GP units to rage souls and prism", () => {
    const rageRule = getMarketplaceGpPricingRule("분노곤충혼");
    const prismRule = getMarketplaceGpPricingRule("프리즘");

    expect(rageRule).toMatchObject({ inputUnitLabel: "천만", unitGp: 10_000_000, maxInput: 10_000 });
    expect(prismRule).toMatchObject({ inputUnitLabel: "천만", unitGp: 10_000_000, maxInput: 10_000 });
    expect(gpAmountFromUnitCount(15, rageRule!)).toBe(150_000_000);
    expect(isValidGpAmountForRule(10_000_000, prismRule!)).toBe(true);
    expect(isValidGpAmountForRule(15_000_000, prismRule!)).toBe(false);
  });

  it("assigns 1억 GP units to rampage souls and preserves the auto-hunt-box rule", () => {
    const rampageRule = getMarketplaceGpPricingRule("폭주드래곤혼");
    const autoHuntRule = getMarketplaceGpPricingRule("자동사냥박스");

    expect(rampageRule).toMatchObject({ inputUnitLabel: "억", unitGp: 100_000_000, maxInput: 1_000 });
    expect(autoHuntRule).toMatchObject({ inputUnitLabel: "억", unitGp: 100_000_000, maxInput: 1_000 });
    expect(gpAmountFromUnitCount(15, rampageRule!)).toBe(1_500_000_000);
    expect(isValidGpAmountForRule(1_500_000_000, rampageRule!)).toBe(true);
    expect(isValidGpAmountForRule(10_000_000, rampageRule!)).toBe(false);
  });
});
