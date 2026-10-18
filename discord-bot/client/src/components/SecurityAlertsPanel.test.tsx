/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchSecurityEvents, acknowledgeSecurityEvent, subscribeToSecurityEvents } = vi.hoisted(() => ({
  fetchSecurityEvents: vi.fn(),
  acknowledgeSecurityEvent: vi.fn(),
  subscribeToSecurityEvents: vi.fn(() => () => undefined),
}));

vi.mock("@/lib/securityEvents", () => ({
  SECURITY_EVENT_LABELS: {
    focus_lost: "창 포커스 이탈",
    print_screen_key: "Print Screen 키 감지",
  },
  fetchSecurityEvents,
  acknowledgeSecurityEvent,
  subscribeToSecurityEvents,
}));

import SecurityAlertsPanel from "./SecurityAlertsPanel";

const unreadEvent = {
  id: "security-1",
  memberId: "member-1",
  memberUsername: "security_user",
  memberNickname: "보안 회원",
  eventType: "print_screen_key" as const,
  path: "/tree",
  createdAt: "2026-08-19T00:00:00.000Z",
  acknowledgedAt: null,
  acknowledgedBy: null,
};

describe("SecurityAlertsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the logged-in member security event and marks it as acknowledged", async () => {
    fetchSecurityEvents.mockResolvedValue([unreadEvent]);
    acknowledgeSecurityEvent.mockResolvedValue({ ...unreadEvent, acknowledgedAt: "2026-08-19T00:01:00.000Z", acknowledgedBy: "admin-1" });

    render(<SecurityAlertsPanel />);

    expect(await screen.findByText("보안 회원")).toBeInTheDocument();
    expect(screen.getByText("Print Screen 키 감지")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인 처리" }));

    await waitFor(() => expect(acknowledgeSecurityEvent).toHaveBeenCalledWith("security-1"));
    expect(await screen.findByText("확인 완료")).toBeInTheDocument();
  });

  it("renders the unread count badge with a high-contrast color treatment", async () => {
    fetchSecurityEvents.mockResolvedValue([unreadEvent]);

    render(<SecurityAlertsPanel />);

    const unreadBadge = await screen.findByTestId("security-unread-count");
    expect(unreadBadge).toHaveTextContent("미확인 1건");
    expect(unreadBadge).toHaveClass("bg-cyan-800", "text-cyan-50", "border-cyan-950");
  });
});
