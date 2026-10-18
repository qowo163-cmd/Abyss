/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MemberManagement from "./MemberManagement";

vi.mock("@/contexts/MembershipContext", () => ({
  useMembership: () => ({
    member: { id: "admin-1", username: "admin", role: "admin", status: "approved" },
  }),
}));

describe("MemberManagement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("filters members and changes a pending member to approved", async () => {
    let members = [
      { id: "member-pending", username: "waiting_member", nickname: "대기 회원", discordNickname: "waiting", gameNickname: "대기헨치", role: "member", status: "pending", approvedAt: null, lastActivityAt: null, lastIpAddress: null, createdAt: "2026-08-17T00:00:00.000Z" },
      { id: "member-approved", username: "approved_member", nickname: "승인 회원", discordNickname: "ether", gameNickname: "에테르", role: "member", status: "approved", approvedAt: "2026-08-17T01:00:00.000Z", lastActivityAt: "2026-08-17T02:30:00.000Z", lastIpAddress: "203.0.113.21", createdAt: "2026-08-16T00:00:00.000Z" },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members/active")) {
        return new Response(JSON.stringify({ count: 1, members: [members[1]] }), { status: 200 });
      }
      if (url.endsWith("/api/auth/members/member-approved/ip-history")) {
        return new Response(JSON.stringify({ logs: [{ id: "ip-log-1", memberId: "member-approved", ipAddress: "203.0.113.21", firstSeenAt: "2026-08-17T01:00:00.000Z", lastSeenAt: "2026-08-17T02:30:00.000Z" }] }), { status: 200 });
      }
      if (url.endsWith("/api/auth/members") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify(members), { status: 200 });
      }
      if (url.endsWith("/api/auth/members/member-pending/status") && init?.method === "PATCH") {
        members = members.map((member) => member.id === "member-pending" ? { ...member, status: JSON.parse(String(init.body)).status } : member);
        return new Response(JSON.stringify({ member: members[0] }), { status: 200 });
      }
      if (url.endsWith("/api/auth/members/member-pending/password/reset") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ member: members[0], message: "비밀번호를 1234로 초기화했습니다." }), { status: 200 });
      }
      if (url.endsWith("/api/auth/members/member-pending") && init?.method === "DELETE") {
        const deleted = members[0];
        members = members.filter((member) => member.id !== "member-pending");
        return new Response(JSON.stringify({ member: deleted }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "unexpected request" }), { status: 404 });
    });

    render(<MemberManagement />);
    expect(await screen.findByText("waiting_member")).toBeInTheDocument();
    expect(screen.getByText("approved_member")).toBeInTheDocument();
    expect(screen.getAllByText("마지막 접속").length).toBeGreaterThan(0);
    expect(screen.getByText("203.0.113.21")).toBeInTheDocument();
    expect(await screen.findByText((_, element) => element?.tagName === "P" && element.textContent === "현재 접속 중인 이용자 1명")).toBeInTheDocument();
    expect(screen.getByText("접속 중인 회원")).toBeInTheDocument();
    expect(screen.getByTestId("active-members-panel")).toHaveClass("abyss-active-members-panel");
    expect(screen.getByTestId("active-members-radar")).toHaveClass("abyss-online-radar");
    expect(screen.getByTestId("active-members-list")).toHaveTextContent("승인 회원 (approved_member)");
    expect(screen.getByTestId("active-members-list").firstElementChild).toHaveClass("abyss-active-member-chip");

    fireEvent.click(screen.getAllByRole("button", { name: "IP 이력" })[1]);
    await waitFor(() => expect(screen.getAllByText("203.0.113.21")).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/members/member-approved/ip-history", { cache: "no-store" });

    const search = screen.getByPlaceholderText("아이디, 닉네임, 디스코드, 인게임 닉네임 검색");
    fireEvent.change(search, { target: { value: "에테르" } });
    expect(await screen.findByText("approved_member")).toBeInTheDocument();
    expect(screen.queryByText("waiting_member")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "승인 대기" }));
    expect(await screen.findByText("waiting_member")).toBeInTheDocument();
    expect(screen.queryByText("approved_member")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => {
      expect(members[0].status).toBe("approved");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/members/member-pending/status",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(screen.getAllByRole("button", { name: "정지" })[0]).toHaveClass("abyss-danger-action");
    expect(screen.getAllByRole("button", { name: "탈퇴" })[0]).toHaveClass("abyss-danger-action");
    fireEvent.click(screen.getAllByRole("button", { name: "비번 1234" })[0]);
    expect(await screen.findByText("회원 비밀번호 초기화")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1234로 초기화" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/members/member-pending/password/reset", { method: "PATCH" }));
    fireEvent.click(screen.getAllByRole("button", { name: "탈퇴" })[0]);
    expect(await screen.findByText("회원 탈퇴 처리")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "탈퇴 처리" }));
    await waitFor(() => {
      expect(screen.queryByText("waiting_member")).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/members/member-pending", { method: "DELETE" });
    });
  });

  it("renders as an embedded panel without the standalone page header", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members/active")) return new Response(JSON.stringify({ count: 0, members: [] }), { status: 200 });
      if (url.endsWith("/api/auth/members")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ message: "unexpected request" }), { status: 404 });
    });

    render(<MemberManagement embedded />);

    expect(await screen.findByTestId("member-management-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "회원 관리" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "관리자" })).not.toBeInTheDocument();
  });
});
