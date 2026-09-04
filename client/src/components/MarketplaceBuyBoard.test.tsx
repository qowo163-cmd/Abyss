/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceBuyBoard } from "./MarketplaceBuyBoard";

vi.mock("@/lib/marketplace", () => ({
  cancelMarketplaceBuyOrder: vi.fn(),
  getMarketplaceBuyOrders: vi.fn().mockResolvedValue({ buyOrders: [] }),
  getMarketplacePriceSummaries: vi.fn().mockResolvedValue({ prices: [] }),
  postMarketplaceBuyOrder: vi.fn(),
  postMarketplaceSaleOffer: vi.fn(),
  updateMarketplaceSaleOffer: vi.fn(),
}));

vi.mock("@/components/MarketplaceMarketInfo", () => ({
  MarketplaceAveragePrice: () => null,
  MarketplaceMonsterImage: () => <div />,
}));

describe("MarketplaceBuyBoard", () => {
  afterEach(() => cleanup());

  it("keeps all own purchase posts in a dedicated scroll area so older posts remain cancellable", () => {
    const buyOrders = Array.from({ length: 10 }, (_, index) => ({
      id: `own-buy-${index + 1}`,
      buyerId: "member-1",
      buyerNickname: "구매자",
      buyerGameNickname: "구매게임닉",
      monster: { id: `hench-${index + 1}`, name: `구매헨치${index + 1}`, attribute: "미스터리", type: null, level: "200 ~ 210" },
      quantity: 1,
      offerBoxes: index + 10,
      note: null,
      status: "active" as const,
      reservedByOfferId: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    }));

    render(<MarketplaceBuyBoard mode="register" monsters={[]} memberId="member-1" mine={{ listings: [], requests: { selling: [], buying: [] }, buyOrders, saleOffers: { received: [], sent: [] } }} onChanged={vi.fn().mockResolvedValue(undefined)} />);

    const list = screen.getByLabelText("내 구매글 전체 목록");
    expect(list).toHaveClass("h-[28rem]");
    expect(within(list).getByText("구매헨치1")).toBeInTheDocument();
    expect(within(list).getByText("구매헨치10")).toBeInTheDocument();
    expect(within(list).getAllByRole("button", { name: "구매 취소" })).toHaveLength(10);
  });

  it("sends a one-hench sale offer with the matching partial purchase price", async () => {
    const marketplace = await import("@/lib/marketplace");
    vi.mocked(marketplace.getMarketplaceBuyOrders).mockResolvedValue({ buyOrders: [{
      id: "buy-partial", buyerId: "other-member", buyerNickname: "구매자", buyerGameNickname: "구매게임닉",
      monster: { id: "hench-1", name: "루루삐", attribute: "미스터리", type: null, level: "208 ~ 233" }, quantity: 2, offerBoxes: 16, note: null,
      status: "active", reservedByOfferId: null, createdAt: "2026-08-21T00:00:00.000Z", updatedAt: "2026-08-21T00:00:00.000Z",
    }] });
    vi.mocked(marketplace.postMarketplaceSaleOffer).mockResolvedValue({ offer: { id: "offer-1" } } as never);

    render(<MarketplaceBuyBoard mode="orders" monsters={[]} memberId="member-1" mine={{ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } }} onChanged={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(await screen.findByRole("button", { name: "판매 제안" }));

    expect(screen.getByText("마리당 자사 8개 × 1마리")).toBeInTheDocument();
    expect(screen.getByText("총 자사 8개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "제안 보내기" }));

    await waitFor(() => expect(marketplace.postMarketplaceSaleOffer).toHaveBeenCalledWith("buy-partial", 1, ""));
  });
});
