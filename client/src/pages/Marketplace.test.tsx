// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Marketplace from "./Marketplace";

const fetchMock = vi.fn();
const membership = vi.hoisted(() => ({ role: "member" as "admin" | "member" }));

vi.mock("@/contexts/MembershipContext", () => ({
  useMembership: () => ({ member: { id: "member-1", nickname: "판매자", gameNickname: "판매게임닉", role: membership.role, status: "approved" } }),
}));

vi.mock("@/hooks/useMonsterData", () => ({
  useMonsterData: () => [{
    id: "hench-1", name: "루루삐", attribute: "미스터리", habitat: "-", main: null, sub: null, main2: null, sub2: null,
    baseLevel: 208, maxLevel: 233, acquired: "x", imageUrl: "/api/monster-image?key=monster-images%2Flulupi.webp",
  }],
}));

function jsonResponse(payload: unknown) {
  return Promise.resolve({ ok: true, json: async () => payload });
}

describe("Marketplace", () => {
  beforeEach(() => {
    membership.role = "member";
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/marketplace/items/mine")) {
        return jsonResponse({ listings: [], received: [], sent: [] });
      }
      if (url.includes("/api/marketplace/items")) {
        return jsonResponse({ listings: [] });
      }
      if (url.includes("/api/marketplace/mine")) {
        return jsonResponse({ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
      }
      if (url.includes("/api/marketplace/buy-orders") && init?.method === "POST") {
        return jsonResponse({ buyOrder: { id: "buy-order-1" } });
      }
      if (url.includes("/api/marketplace/listings") && init?.method === "POST") {
        return jsonResponse({ listing: { id: "listing-1" } });
      }
      if (url.includes("/api/marketplace/price-summaries")) return jsonResponse({ prices: [] });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({ listings: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("allows approved regular members to register listings after the marketplace opens", async () => {
    render(<Marketplace />);

    expect((await screen.findAllByText("어비스거래소")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "판매중" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "통합 등록" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "교환중" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "아이템 거래" })).toBeInTheDocument();
    expect(screen.getByText("자사 · 자동사냥박스")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("거래소가 정식 오픈되었습니다");
    expect(screen.getByLabelText("거래소 주요 탭")).toContainElement(screen.getByRole("button", { name: "판매중" }));
    expect(screen.getByLabelText("거래소 주요 탭")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("reserved-trade-count")).toHaveClass("text-sky-800");
  });

  it("shows received requests in the header inbox with a badge and exposes own listings beside it", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/marketplace/tab-settings")) return jsonResponse({ settings: { sellEnabled: true, buyEnabled: true, exchangeEnabled: true, itemsEnabled: true, updatedAt: null } });
      if (url.includes("/api/marketplace/exchanges/mine")) return jsonResponse({ listings: [], received: [], sent: [] });
      if (url.includes("/api/marketplace/items/mine")) return jsonResponse({ listings: [], received: [], sent: [] });
      if (url === "/api/marketplace/requests/request-inbox" && init?.method === "PATCH") return jsonResponse({ request: { id: "request-inbox" } });
      if (url.includes("/api/marketplace/mine")) return jsonResponse({
        listings: [{ id: "own-sale", sellerId: "member-1", sellerNickname: "판매자", sellerGameNickname: "판매게임닉", monster: { id: "hench-1", name: "루루삐", attribute: null, type: null, level: null }, quantity: 2, priceBoxes: 16, note: null, status: "active", reservedByRequestId: null, createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" }],
        requests: { selling: [{ id: "request-inbox", listingId: "own-sale", sellerId: "member-1", buyerId: "other-member", buyerNickname: "구매자", buyerGameNickname: "구매게임닉", requestedQuantity: 1, requestedPriceBoxes: 8, message: "한 마리만 구매합니다.", status: "pending", respondedAt: null, createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z", listing: { monster: { id: "hench-1", name: "루루삐", attribute: null, type: null, level: null }, quantity: 2, priceBoxes: 16, sellerNickname: "판매자", sellerGameNickname: "판매게임닉", status: "active" } }], buying: [] },
        buyOrders: [], saleOffers: { received: [], sent: [] },
      });
      if (url.includes("/api/marketplace/price-summaries")) return jsonResponse({ prices: [] });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({ listings: [] });
    });

    render(<Marketplace />);
    const inboxButton = await screen.findByRole("button", { name: /거래 요청함 미처리 1건/ });
    expect(screen.getByTestId("marketplace-inbox-badge")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "내 등록글" })).toBeInTheDocument();

    fireEvent.click(inboxButton);
    expect(await screen.findByText("판매 요청 · 루루삐")).toBeInTheDocument();
    expect(screen.getByText("구매게임닉님 · 1마리 · 자사 8개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/marketplace/requests/request-inbox" && init?.method === "PATCH")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "내 등록글" }));
    expect(await screen.findByText("판매 · 루루삐")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록 취소" })).toHaveClass("bg-rose-700", "text-white", "border-rose-950");
  });

  it("hides administrator-disabled marketplace tabs from regular members", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/marketplace/tab-settings")) return jsonResponse({ settings: { sellEnabled: false, buyEnabled: true, exchangeEnabled: false, itemsEnabled: false, updatedAt: null } });
      if (url.includes("/api/marketplace/mine")) return jsonResponse({ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({ listings: [] });
    });

    render(<Marketplace />);

    await waitFor(() => expect(screen.queryByRole("button", { name: "판매중" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "구매중" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "교환중" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "아이템 거래" })).not.toBeInTheDocument();
  });

  it("keeps item-market registration available to approved regular members", async () => {
    render(<Marketplace />);
    await screen.findByText("현재 판매 중인 헨치가 없습니다.");

    fireEvent.click(screen.getByRole("button", { name: "아이템 거래" }));
    expect(await screen.findByText("현재 조건의 아이템 거래글이 없습니다.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "아이템 등록" })).toBeInTheDocument();
  });

  it("allows an administrator to access unified hench and item registration", async () => {
    membership.role = "admin";
    render(<Marketplace />);
    await screen.findByText("현재 판매 중인 헨치가 없습니다.");

    expect(screen.getByRole("button", { name: "통합 등록" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "아이템 거래" }));
    expect(await screen.findByRole("button", { name: "아이템 등록" })).toBeInTheDocument();
  });

  it("shows the uploaded catalog icon on a matching item trade listing", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/marketplace/items/mine")) return jsonResponse({ listings: [], received: [], sent: [] });
      if (url.includes("/api/marketplace/items")) return jsonResponse({ listings: [{ id: "item-listing-1", ownerId: "other-member", ownerNickname: "거래상", ownerGameNickname: "상점캐릭터", listingType: "sell", itemName: "자동사냥박스", quantity: 3, priceBoxes: 100000000, priceCurrency: "gp", wantedItems: [], note: null, status: "active", createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" }] });
      if (url.includes("/api/marketplace/mine")) return jsonResponse({ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
      if (url.includes("/api/marketplace/price-summaries")) return jsonResponse({ prices: [] });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({ listings: [] });
    });

    render(<Marketplace />);
    await screen.findByText("현재 판매 중인 헨치가 없습니다.");
    fireEvent.click(screen.getByRole("button", { name: "아이템 거래" }));

    expect(await screen.findByAltText("자동사냥박스 아이템")).toHaveAttribute("src", "/manus-storage/auto-hunt-box_c3920c84.png");
    expect(screen.getByText("GP 가격 · 전체")).toBeInTheDocument();
    expect(screen.getByText("1억 GP")).toBeInTheDocument();
  });

  it("shows a hench image and the recent two-week average above the listing price", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/marketplace/mine")) return jsonResponse({ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
      if (url.includes("/api/marketplace/price-summaries")) return jsonResponse({ prices: [{ monsterId: "hench-1", recentCompletedCount: 2, recentAverageBoxesPerUnit: 35, baselineBoxesPerUnit: 20, displayBoxesPerUnit: 35, source: "recent" }] });
      if (url.includes("/api/marketplace/listings")) return jsonResponse({ listings: [{ id: "listing-1", sellerId: "other-member", sellerNickname: "판매자", sellerGameNickname: "판매게임닉", monster: { id: "hench-1", name: "루루삐", attribute: "미스터리", type: "장코", level: "208 ~ 233" }, quantity: 2, priceBoxes: 80, note: null, status: "active", reservedByRequestId: null, createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" }] });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({});
    });

    render(<Marketplace />);

    expect(await screen.findByAltText("루루삐 이미지")).toHaveAttribute("src", "/api/monster-image?key=monster-images%2Flulupi.webp");
    expect(screen.getByText("최근 2주 거래 2건 · 마리당")).toBeInTheDocument();
    expect(screen.getByText("35개")).toBeInTheDocument();
    expect(screen.getByText("자사 가격 · 전체")).toBeInTheDocument();
  });

  it("allows a buyer to request only part of a multi-hench sale listing at the per-hench price", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/marketplace/mine")) return jsonResponse({ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
      if (url.includes("/api/marketplace/price-summaries")) return jsonResponse({ prices: [] });
      if (url.includes("/api/marketplace/listings/listing-partial/requests") && init?.method === "POST") return jsonResponse({ request: { id: "request-1" } });
      if (url.includes("/api/marketplace/listings")) return jsonResponse({ listings: [{ id: "listing-partial", sellerId: "other-member", sellerNickname: "판매자", sellerGameNickname: "판매게임닉", monster: { id: "hench-1", name: "루루삐", attribute: "미스터리", type: "장코", level: "208 ~ 233" }, quantity: 2, priceBoxes: 16, note: null, status: "active", reservedByRequestId: null, createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" }] });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({});
    });

    render(<Marketplace />);
    fireEvent.click(await screen.findByRole("button", { name: "거래 요청" }));

    expect(screen.getByText("마리당 자사 8개 × 1마리")).toBeInTheDocument();
    expect(screen.getByText("총 자사 8개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "요청 보내기" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/marketplace/listings/listing-partial/requests" && init?.method === "POST");
      expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ quantity: 1, message: "" });
    });
  });

  it("searches a hench and submits its quantity and automatic-hunting-box price", async () => {
    membership.role = "admin";
    render(<Marketplace />);
    await screen.findByText("현재 판매 중인 헨치가 없습니다.");

    fireEvent.click(screen.getByRole("button", { name: "통합 등록" }));
    fireEvent.change(screen.getByPlaceholderText("헨치 이름을 입력해 검색"), { target: { value: "루루" } });
    fireEvent.click(screen.getByRole("button", { name: /루루삐/ }));

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "2" } });
    fireEvent.change(numberInputs[1], { target: { value: "45" } });
    expect(screen.getByTestId("sale-total-price-preview")).toHaveTextContent("마리당 자사 45개 × 2마리");
    expect(screen.getByTestId("sale-total-price-preview")).toHaveTextContent("전체 자사 90개");
    fireEvent.click(screen.getByRole("button", { name: "판매글 등록" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/marketplace/listings" && init?.method === "POST");
      expect(postCall).toBeTruthy();
      expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ monsterId: "hench-1", quantity: 2, unitPriceBoxes: 45, note: "" });
    });
  });

  it("registers a purchase order with the selected hench and offered automatic-hunting-box price", async () => {
    membership.role = "admin";
    render(<Marketplace />);
    await screen.findByText("현재 판매 중인 헨치가 없습니다.");

    fireEvent.click(screen.getByRole("button", { name: "통합 등록" }));
    fireEvent.click(screen.getByRole("button", { name: "구매 등록" }));
    fireEvent.change(screen.getByPlaceholderText("헨치 이름을 입력해 검색"), { target: { value: "루루" } });
    fireEvent.click(screen.getByRole("button", { name: /루루삐/ }));

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "2" } });
    fireEvent.change(numberInputs[1], { target: { value: "60" } });
    expect(screen.getByTestId("buy-total-price-preview")).toHaveTextContent("마리당 자사 60개 × 2마리");
    expect(screen.getByTestId("buy-total-price-preview")).toHaveTextContent("전체 자사 120개");
    fireEvent.click(screen.getByRole("button", { name: "구매글 등록" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/marketplace/buy-orders" && init?.method === "POST");
      expect(postCall).toBeTruthy();
      expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ monsterId: "hench-1", quantity: 2, unitOfferBoxes: 60, note: "" });
    });
  });

  it("keeps every own sale listing in a dedicated scroll area so older listings remain cancellable", async () => {
    const ownListings = Array.from({ length: 10 }, (_, index) => ({
      id: `own-sale-${index + 1}`,
      sellerId: "member-1",
      sellerNickname: "판매자",
      sellerGameNickname: "판매게임닉",
      monster: { id: `hench-${index + 1}`, name: `판매헨치${index + 1}`, attribute: "미스터리", type: null, level: "200 ~ 210" },
      quantity: 1,
      priceBoxes: 10 + index,
      note: null,
      status: "active",
      reservedByRequestId: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    }));
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/marketplace/tab-settings")) return jsonResponse({ settings: { sellEnabled: true, buyEnabled: true, exchangeEnabled: true, itemsEnabled: true, updatedAt: null } });
      if (url.includes("/api/marketplace/mine")) return jsonResponse({ listings: ownListings, requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
      if (url.includes("/api/marketplace/price-summaries")) return jsonResponse({ prices: [] });
      if (url.includes("/api/marketplace/buy-orders")) return jsonResponse({ buyOrders: [] });
      return jsonResponse({ listings: [] });
    });

    render(<Marketplace />);
    await screen.findByRole("button", { name: "통합 등록" });
    fireEvent.click(screen.getByRole("button", { name: "통합 등록" }));

    const list = screen.getByLabelText("내 판매글 전체 목록");
    expect(list).toHaveClass("max-h-[28rem]", "overflow-y-auto");
    expect(within(list).getByText("판매헨치1")).toBeInTheDocument();
    expect(within(list).getByText("판매헨치10")).toBeInTheDocument();
    expect(within(list).getAllByRole("button", { name: "판매 취소" })).toHaveLength(10);
  });
});
