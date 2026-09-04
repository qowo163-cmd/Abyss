/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarketplaceHistoryAdminPanel from "./MarketplaceHistoryAdminPanel";

const marketplaceMocks = vi.hoisted(() => ({ getAdminMarketplaceHistory: vi.fn() }));
vi.mock("@/lib/marketplace", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/marketplace")>()), ...marketplaceMocks }));

describe("MarketplaceHistoryAdminPanel", () => {
  beforeEach(() => {
    marketplaceMocks.getAdminMarketplaceHistory.mockResolvedValue({ records: [{
      id: "item-request-buy-1", recordKind: "request", category: "item", listingType: "buy", subjectName: "프리즘", quantity: 3,
      priceAmount: 30_000_000, priceCurrency: "gp", ownerNickname: "구매자", ownerGameNickname: "구매게임닉",
      counterpartNickname: "판매자", counterpartGameNickname: "판매게임닉", status: "rejected", note: "다음에 거래", createdAt: "2026-08-20T01:00:00.000Z", updatedAt: "2026-08-20T02:00:00.000Z",
    }] });
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders proposal history and sends status filters to the protected history endpoint client", async () => {
    render(<MarketplaceHistoryAdminPanel />);

    expect(await screen.findByText("프리즘")).toBeInTheDocument();
    expect(screen.getByText("거래 제안 · 아이템 · 구매")).toBeInTheDocument();
    expect(screen.getAllByText("제안 거절").length).toBeGreaterThan(0);
    expect(screen.getByTestId("marketplace-history-status-rejected")).toHaveClass("border-rose-600", "text-rose-900");
    expect(screen.getByText(/3천만 GP/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("상태"), { target: { value: "rejected" } });
    await waitFor(() => expect(marketplaceMocks.getAdminMarketplaceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ status: "rejected", limit: 200 })));
  });

  it("renders a bounded first page of long history and expands only on request", async () => {
    marketplaceMocks.getAdminMarketplaceHistory.mockResolvedValue({ records: Array.from({ length: 55 }, (_, index) => ({
      id: `record-${index}`, recordKind: "listing", category: "hench", listingType: "sell", subjectName: `헨치${index}`, quantity: 1,
      priceAmount: 5, priceCurrency: "autoHunt", ownerNickname: "판매자", ownerGameNickname: "판매게임닉",
      counterpartNickname: null, counterpartGameNickname: null, status: "active", note: null, createdAt: "2026-08-20T01:00:00.000Z", updatedAt: "2026-08-20T02:00:00.000Z",
    })) });

    render(<MarketplaceHistoryAdminPanel />);
    await screen.findByText("헨치0");
    expect(screen.getAllByTestId("marketplace-history-record")).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: /거래 기록 더 보기/ }));
    expect(screen.getAllByTestId("marketplace-history-record")).toHaveLength(55);
  });
});
