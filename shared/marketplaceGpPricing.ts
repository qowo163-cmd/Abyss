export type MarketplaceGpPricingRule = {
  id: "standard-gp" | "auto-hunt-box" | "rage-soul" | "prism" | "rampage-soul";
  displayName: string;
  unitGp: number;
  inputUnitLabel: "천만" | "억";
  maxInput: number;
  exampleInput: number;
  inputHelp: string;
};

const TEN_MILLION_GP = 10_000_000;
const ONE_HUNDRED_MILLION_GP = 100_000_000;
const MAX_GP_AMOUNT = 100_000_000_000;
export const RAMPAGE_SOULS_PER_AUTO_HUNT_BOX = 2;

export const DEFAULT_MARKETPLACE_GP_PRICING_RULE: MarketplaceGpPricingRule = {
  id: "standard-gp",
  displayName: "일반 아이템",
  unitGp: ONE_HUNDRED_MILLION_GP,
  inputUnitLabel: "억",
  maxInput: MAX_GP_AMOUNT / ONE_HUNDRED_MILLION_GP,
  exampleInput: 15,
  inputHelp: "1~1,000억 범위에서 1억 GP 단위 수량을 입력하세요.",
};

const RULES: Record<Exclude<MarketplaceGpPricingRule["id"], "standard-gp">, MarketplaceGpPricingRule> = {
  "auto-hunt-box": {
    id: "auto-hunt-box",
    displayName: "자동사냥박스",
    unitGp: ONE_HUNDRED_MILLION_GP,
    inputUnitLabel: "억",
    maxInput: MAX_GP_AMOUNT / ONE_HUNDRED_MILLION_GP,
    exampleInput: 15,
    inputHelp: "1~1,000억 범위에서 억 단위 수량을 입력하세요.",
  },
  "rage-soul": {
    id: "rage-soul",
    displayName: "분노의 혼",
    unitGp: TEN_MILLION_GP,
    inputUnitLabel: "천만",
    maxInput: MAX_GP_AMOUNT / TEN_MILLION_GP,
    exampleInput: 15,
    inputHelp: "1천만~1,000억 범위에서 1천만 GP 단위 수량을 입력하세요.",
  },
  prism: {
    id: "prism",
    displayName: "프리즘",
    unitGp: TEN_MILLION_GP,
    inputUnitLabel: "천만",
    maxInput: MAX_GP_AMOUNT / TEN_MILLION_GP,
    exampleInput: 15,
    inputHelp: "1천만~1,000억 범위에서 1천만 GP 단위 수량을 입력하세요.",
  },
  "rampage-soul": {
    id: "rampage-soul",
    displayName: "폭주의 혼",
    unitGp: ONE_HUNDRED_MILLION_GP,
    inputUnitLabel: "억",
    maxInput: MAX_GP_AMOUNT / ONE_HUNDRED_MILLION_GP,
    exampleInput: 15,
    inputHelp: "1~1,000억 범위에서 1억 GP 단위 수량을 입력하세요.",
  },
};

function normalizeItemName(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function getMarketplaceGpPricingRule(itemName?: string | null): MarketplaceGpPricingRule | null {
  const normalized = normalizeItemName(itemName || "");

  if (normalized === "자동사냥박스") return RULES["auto-hunt-box"];
  if (normalized === "프리즘") return RULES.prism;
  if (normalized.startsWith("분노") && normalized.endsWith("혼")) return RULES["rage-soul"];
  if (normalized.startsWith("폭주") && normalized.endsWith("혼")) return RULES["rampage-soul"];

  return null;
}

export function isRampageSoul(itemName?: string | null): boolean {
  return getMarketplaceGpPricingRule(itemName)?.id === "rampage-soul";
}

export function gpAmountFromUnitCount(unitCount: number, rule: MarketplaceGpPricingRule): number {
  return unitCount * rule.unitGp;
}

export function isValidGpAmountForRule(amount: unknown, rule: MarketplaceGpPricingRule): boolean {
  const numericAmount = Number(amount);
  return Number.isInteger(numericAmount)
    && numericAmount >= rule.unitGp
    && numericAmount <= rule.maxInput * rule.unitGp
    && numericAmount % rule.unitGp === 0;
}

export function gpPricingValidationMessage(rule: MarketplaceGpPricingRule): string {
  return `${rule.displayName} GP 가격은 ${rule.inputHelp}`;
}
