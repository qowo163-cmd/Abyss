/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MembershipProvider } from "@/contexts/MembershipContext";
import { MembershipGate } from "./MembershipGate";

const approvedMember = {
  id: "member-1",
  username: "approved_member",
  nickname: "승인회원",
  discordNickname: "approved",
  gameNickname: "approved",
  role: "member" as const,
  status: "approved" as const,
};

function renderWithSession(member: unknown) {
  window.history.pushState({}, "", "/");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) === "/api/auth/session") {
      return new Response(JSON.stringify({ member }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  });

  return render(
    <MembershipProvider>
      <MembershipGate><div>보호된 헨치 데이터</div></MembershipGate>
    </MembershipProvider>,
  );
}

describe("MembershipGate", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated visitors to the login screen", async () => {
    renderWithSession(null);
    expect(await screen.findByText("ABYSS서버 믹스사이트 로그인")).toBeInTheDocument();
    expect(screen.queryByText("보호된 헨치 데이터")).not.toBeInTheDocument();
  });

  it("renders protected site content for an approved member", async () => {
    renderWithSession(approvedMember);
    expect(await screen.findByText("보호된 헨치 데이터")).toBeInTheDocument();
  });
});
