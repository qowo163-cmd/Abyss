import { describe, expect, it, vi } from "vitest";

const pushStore = vi.hoisted(() => ({
  listMemberExpoPushTokens: vi.fn(),
  disableMemberExpoPushToken: vi.fn(),
}));

vi.mock("./memberAuth.js", () => pushStore);

import { sendMarketplaceRequestPushAlert } from "./marketplacePushNotifications";

const alert = {
  id: "request-alert-1",
  recipientMemberId: "seller-1",
  kind: "hench-sell" as const,
  title: "새 구매 요청",
  body: "구매자님이 로엘 · 1마리 거래를 요청했습니다.",
  targetName: "로엘",
  actorName: "구매자",
  createdAt: Date.now(),
};

describe("sendMarketplaceRequestPushAlert", () => {
  it("sends high-priority marketplace push only to the recipient's registered devices", async () => {
    pushStore.listMemberExpoPushTokens.mockResolvedValue([{ token: "ExpoPushToken[seller-device]" }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }), { status: 200 }));

    await sendMarketplaceRequestPushAlert(alert, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual([expect.objectContaining({
      to: "ExpoPushToken[seller-device]",
      channelId: "abyss-marketplace",
      sound: "default",
      priority: "high",
      data: { target: "inbox", alertId: "request-alert-1", kind: "hench-sell", url: "/marketplace" },
    })]);
  });

  it("disables a device token when Expo reports that it is no longer registered", async () => {
    pushStore.listMemberExpoPushTokens.mockResolvedValue([{ token: "ExpoPushToken[retired-device]" }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } }],
    }), { status: 200 }));

    await sendMarketplaceRequestPushAlert(alert, fetchMock);

    expect(pushStore.disableMemberExpoPushToken).toHaveBeenCalledWith("ExpoPushToken[retired-device]", "not registered");
  });
});
