/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SideNavigation } from "./SideNavigation";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("./OnlineMemberCount", () => ({
  OnlineMemberCount: () => <div data-testid="online-member-count">현재 접속 3명</div>,
}));

describe("SideNavigation logout", () => {
  afterEach(() => cleanup());

  it("provides a logout button that delegates to the supplied session handler", () => {
    const onLogout = vi.fn();
    render(<SideNavigation currentPath="/" onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sidebar-logout-button")).toHaveClass("text-sky-950");
  });

  it("places the online member count immediately above logout", () => {
    render(<SideNavigation currentPath="/" onLogout={vi.fn()} />);

    const count = screen.getByTestId("online-member-count");
    const logout = screen.getByRole("button", { name: "로그아웃" });
    expect(count.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses the ABYSS character site icon in the upper-left brand area", () => {
    render(<SideNavigation currentPath="/" onLogout={vi.fn()} />);

    expect(screen.getByAltText("ABYSS 캐릭터 아이콘")).toHaveAttribute(
      "src",
      "/manus-storage/abyss-character-site-icon-512_6ecd4cc9.png",
    );
    expect(screen.getByText("ABYSS")).toBeInTheDocument();
    expect(screen.getByText("서버")).toBeInTheDocument();
  });

  it("links the desktop navigation to the marketplace tab", () => {
    render(<SideNavigation currentPath="/marketplace" onLogout={vi.fn()} />);

    expect(screen.getByRole("link", { name: "거래소" })).toHaveAttribute("href", "/marketplace");
  });

  it("shows the administrator dashboard entry only for administrators", () => {
    const { rerender } = render(<SideNavigation currentPath="/" onLogout={vi.fn()} />);
    expect(screen.queryByTestId("sidebar-admin-dashboard-link")).not.toBeInTheDocument();

    rerender(<SideNavigation currentPath="/" isAdmin onLogout={vi.fn()} />);
    expect(screen.getByTestId("sidebar-admin-dashboard-link")).toHaveAttribute("href", "/admin");
  });

  it("shows 역산믹스법 after 믹스법 while keeping material calculator removed", () => {
    render(<SideNavigation currentPath="/marketplace" onLogout={vi.fn()} />);

    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(screen.getByRole("link", { name: "역산믹스법" })).toHaveAttribute("href", "/reverse");
    expect(labels.indexOf("역산믹스법")).toBe(labels.indexOf("믹스법") + 1);
    expect(labels.indexOf("거래소")).toBe(labels.indexOf("역산믹스법") + 1);
    expect(screen.queryByRole("link", { name: "재료 계산기" })).not.toBeInTheDocument();
  });
});
