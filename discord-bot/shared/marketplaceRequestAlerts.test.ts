import { describe, expect, it } from "vitest";
import { createMarketplaceRequestAlert } from "./marketplaceRequestAlerts";

describe("marketplace request alert", () => {
  it("creates a recipient-scoped alert card payload", () => {
    const alert = createMarketplaceRequestAlert({
      recipientMemberId: "seller-1",
      kind: "hench-sell",
      actorName: "구매자",
      targetName: "로엘",
      quantity: 2,
    });

    expect(alert.recipientMemberId).toBe("seller-1");
    expect(alert.title).toBe("새 구매 요청");
    expect(alert.body).toContain("구매자님");
    expect(alert.body).toContain("로엘");
    expect(alert.body).toContain("2마리");
  });
});
