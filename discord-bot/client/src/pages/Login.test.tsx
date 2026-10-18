/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Login from "./Login";

vi.mock("wouter", () => ({
  useLocation: () => ["/login", vi.fn()],
}));

describe("Login visual background", () => {
  it("uses the text-free fantasy background behind a readable login form", () => {
    render(<Login onLoginSuccess={vi.fn()} />);

    expect(screen.getByTestId("login-background")).toHaveAttribute(
      "src",
      "/manus-storage/abyss-login-background-no-text_2b2ef8a0.webp",
    );
    expect(screen.getByText("ABYSS서버 믹스사이트 로그인")).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toBeVisible();
    expect(screen.getByLabelText("비밀번호")).toBeVisible();
    expect(screen.getByRole("button", { name: "비밀번호 재설정" })).toBeVisible();
  });
});
