import type { MarketplaceRequestAlert } from "../shared/marketplaceRequestAlerts.js";
import { disableMemberExpoPushToken, listMemberExpoPushTokens } from "./memberAuth.js";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushTicket = {
  status?: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

type ExpoPushResponse = { data?: ExpoPushTicket | ExpoPushTicket[] };

export async function sendMarketplaceRequestPushAlert(
  alert: MarketplaceRequestAlert,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  const deviceTokens = await listMemberExpoPushTokens(alert.recipientMemberId);
  if (deviceTokens.length === 0) return;

  const response = await fetchImplementation(EXPO_PUSH_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deviceTokens.map(({ token }) => ({
      to: token,
      title: "ABYSS 거래 요청",
      body: alert.body,
      sound: "default",
      priority: "high",
      channelId: "abyss-marketplace",
      data: { target: "inbox", alertId: alert.id, kind: alert.kind, url: "/marketplace" },
    }))),
  });

  if (!response.ok) {
    console.warn(`Expo push delivery request failed (${response.status}) for marketplace alert ${alert.id}`);
    return;
  }

  const responseBody = (await response.json().catch(() => ({}))) as ExpoPushResponse;
  const tickets = Array.isArray(responseBody.data) ? responseBody.data : responseBody.data ? [responseBody.data] : [];
  await Promise.all(tickets.map(async (ticket, index) => {
    if (ticket.status !== "error" || ticket.details?.error !== "DeviceNotRegistered") return;
    const token = deviceTokens[index]?.token;
    if (token) await disableMemberExpoPushToken(token, ticket.message || "DeviceNotRegistered");
  }));
}
