/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MembershipProvider, useMembership } from "./MembershipContext";

function LogoutProbe() {
  const { member, logout } = useMembership();
  return (
    <div>
      <span>{member?.username || "로그아웃됨"}</span>
      <button type="button" onClick={() => void logout()}>로그아웃</button>
    </div>
  );
}

describe("MembershipProvider logout", () => {
  afterEach(() => vi.restoreAllMocks());

  it("revokes the server session and removes the local approved member state", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input) === "/api/auth/session") {
        return new Response(JSON.stringify({ member: { id: "m1", username: "abyss", status: "approved" } }), { status: 200 });
      }
      if (String(input) === "/api/auth/logout") {
        expect(init).toMatchObject({ method: "POST" });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });

    render(<MembershipProvider><LogoutProbe /></MembershipProvider>);
    expect(await screen.findByText("abyss")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(screen.getByText("로그아웃됨")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });
});
