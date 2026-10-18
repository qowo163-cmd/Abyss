/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE_ALERT_TEST_EVENT, MarketplaceRequestNotifier } from "./MarketplaceRequestNotifier";

const setLocation = vi.fn();
let eventSource: FakeEventSource | undefined;

class FakeEventSource {
  listeners = new Map<string, EventListener>();
  constructor(_url: string) { eventSource = this; }
  addEventListener(type: string, listener: EventListener) { this.listeners.set(type, listener); }
  close() {}
  emit(type: string, data: unknown) { this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent); }
}

vi.mock("wouter", () => ({ useLocation: () => ["/", setLocation] }));

describe("MarketplaceRequestNotifier", () => {
  afterEach(() => {
    cleanup();
    setLocation.mockReset();
    eventSource = undefined;
    window.localStorage.clear();
    delete window.abyssAndroidPushToken;
    vi.unstubAllGlobals();
  });

  it("shows a card only for the recipient and routes it to the inbox", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    render(<MarketplaceRequestNotifier memberId="seller-1" />);

    act(() => eventSource?.emit("marketplace-request", { id: "request-1", recipientMemberId: "seller-1", kind: "hench-sell", title: "새 구매 요청", body: "구매자님이 로엘 · 2마리 거래를 요청했습니다.", targetName: "로엘", actorName: "구매자", createdAt: Date.now() }));
    expect(screen.getByTestId("marketplace-request-alert-card")).toHaveTextContent("새 구매 요청");
    expect(screen.getByText(/구매자님이 로엘/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /요청함 열기/ }));
    expect(setLocation).toHaveBeenCalledWith("/marketplace?tab=inbox");
  });

  it("shows the same card for an administrator-triggered alert test even when alerts are disabled", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    window.localStorage.setItem("abyss-marketplace-alert-settings", JSON.stringify({ enabled: false, volume: 0.82, browserNotifications: false }));
    render(<MarketplaceRequestNotifier memberId="admin-1" />);

    act(() => window.dispatchEvent(new CustomEvent(MARKETPLACE_ALERT_TEST_EVENT, {
      detail: { id: "preview-1", recipientMemberId: "admin-1", kind: "hench-sell", title: "새 구매 요청", body: "알림 테스트님이 로엘 · 1마리 거래를 요청했습니다.", targetName: "로엘", actorName: "알림 테스트", createdAt: Date.now() },
    })));

    expect(screen.getByTestId("marketplace-request-alert-card")).toHaveTextContent("알림 테스트님이 로엘");
  });

  it("registers the Android Expo push token through the approved member session", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    window.abyssAndroidPushToken = { token: "ExpoPushToken[android-device_1]", enabled: true };

    render(<MarketplaceRequestNotifier memberId="seller-1" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/mobile/push-token", expect.objectContaining({ method: "PUT" })));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ token: "ExpoPushToken[android-device_1]", enabled: true });
  });
});
