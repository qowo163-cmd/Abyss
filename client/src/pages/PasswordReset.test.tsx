/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PasswordReset from "./PasswordReset";

const setLocation = vi.fn();
vi.mock("wouter", () => ({ useLocation: () => ["/password-reset", setLocation] }));

describe("PasswordReset", () => {
  afterEach(() => { vi.restoreAllMocks(); setLocation.mockReset(); });

  it("changes only the entered username after collecting username, current password, and a new password", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ member: { username: "target_user" } }), { status: 200 }));
    render(<PasswordReset />);

    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "target_user" } });
    fireEvent.change(screen.getByLabelText("기존 비밀번호"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/password/change", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ username: "target_user", currentPassword: "old-password", newPassword: "new-password" }),
    })));
    await waitFor(() => expect(setLocation).toHaveBeenCalledWith("/login"));
  });
});
