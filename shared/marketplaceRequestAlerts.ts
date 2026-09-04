export type MarketplaceRequestKind = "hench-sell" | "hench-buy" | "exchange" | "item";

export type MarketplaceRequestAlert = {
  id: string;
  recipientMemberId: string;
  kind: MarketplaceRequestKind;
  title: string;
  body: string;
  targetName: string;
  actorName: string;
  createdAt: number;
};

const kindLabel: Record<MarketplaceRequestKind, string> = {
  "hench-sell": "새 구매 요청",
  "hench-buy": "새 판매 제안",
  exchange: "새 교환 제안",
  item: "새 아이템 거래 요청",
};

export function createMarketplaceRequestAlert(input: {
  recipientMemberId: string;
  kind: MarketplaceRequestKind;
  actorName: string;
  targetName: string;
  quantity?: number | null;
}): MarketplaceRequestAlert {
  const quantity = Number.isInteger(input.quantity) && Number(input.quantity) > 0
    ? ` · ${input.quantity}${input.kind === "item" ? "개" : "마리"}`
    : "";
  return {
    id: `marketplace-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recipientMemberId: input.recipientMemberId,
    kind: input.kind,
    title: kindLabel[input.kind],
    body: `${input.actorName}님이 ${input.targetName}${quantity} 거래를 요청했습니다.`,
    targetName: input.targetName,
    actorName: input.actorName,
    createdAt: Date.now(),
  };
}
