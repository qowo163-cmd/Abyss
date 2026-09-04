/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceItemBoard } from "./MarketplaceItemBoard";

const marketplaceMocks = vi.hoisted(() => ({
  cancelMarketplaceItemListing: vi.fn(),
  getMarketplaceItemListings: vi.fn(),
  getMarketplaceItemPriceSummaries: vi.fn(),
  getMyMarketplaceItems: vi.fn(),
  postMarketplaceItemListing: vi.fn(),
  postMarketplaceItemRequest: vi.fn(),
  updateMarketplaceItemRequest: vi.fn(),
}));

vi.mock("@/lib/marketplace", () => marketplaceMocks);

describe("MarketplaceItemBoard 거래 화폐 선택", () => {
  beforeEach(() => {
    marketplaceMocks.getMarketplaceItemListings.mockResolvedValue({ listings: [] });
    marketplaceMocks.getMarketplaceItemPriceSummaries.mockResolvedValue({ prices: [] });
    marketplaceMocks.getMyMarketplaceItems.mockResolvedValue({ listings: [], received: [], sent: [] });
    marketplaceMocks.postMarketplaceItemListing.mockResolvedValue({ listing: { id: "created" } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("allows a normal item to be registered with a GP price selected by the member", async () => {
    render(<MarketplaceItemBoard memberId="member-1" canRegister onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "아이템 등록" }));
    fireEvent.change(screen.getByPlaceholderText("등록된 아이템을 선택하거나 직접 입력"), { target: { value: "40배세트" } });
    fireEvent.click(screen.getByRole("button", { name: "GP" }));

    expect(screen.getByText("개당 GP 가격")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("예: 15"), { target: { value: "15" } });
    expect(screen.getByTestId("item-total-price-preview")).toHaveTextContent("전체 15억 GP");
    fireEvent.click(screen.getByRole("button", { name: "아이템 판매글 등록" }));

    await waitFor(() => {
      expect(marketplaceMocks.postMarketplaceItemListing).toHaveBeenCalledWith(expect.objectContaining({
        itemName: "40배세트",
        priceCurrency: "gp",
        unitPrice: 1_500_000_000,
      }));
    });
  });

  it("allows rage souls to switch between boxes and their configured GP unit", () => {
    render(<MarketplaceItemBoard memberId="member-1" canRegister onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "아이템 등록" }));
    fireEvent.change(screen.getByPlaceholderText("등록된 아이템을 선택하거나 직접 입력"), { target: { value: "분노곤충혼" } });

    expect(screen.getByRole("button", { name: "자사" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "GP" }));
    expect(screen.getByText("개당 GP 가격")).toBeInTheDocument();
    expect(screen.getByText("천만")).toBeInTheDocument();
  });

  it("registers rampage souls in two-item units with one auto-hunt box per unit", async () => {
    render(<MarketplaceItemBoard memberId="member-1" canRegister onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "아이템 등록" }));
    fireEvent.change(screen.getByPlaceholderText("등록된 아이템을 선택하거나 직접 입력"), { target: { value: "폭주드래곤혼" } });
    expect(screen.getByText("폭주의 혼 2개당 자동사냥박스 1개")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/수량/), { target: { value: "4" } });
    expect(screen.getByText("폭주의 혼 4개 = 자동사냥박스 2개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "아이템 판매글 등록" }));

    await waitFor(() => {
      expect(marketplaceMocks.postMarketplaceItemListing).toHaveBeenCalledWith(expect.objectContaining({
        itemName: "폭주드래곤혼",
        quantity: 4,
        priceBoxes: 2,
        priceCurrency: "boxes",
      }));
    });
  });
});
