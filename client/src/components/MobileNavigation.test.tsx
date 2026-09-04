/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileNavigation from "./MobileNavigation";

describe("MobileNavigation", () => {
  afterEach(() => cleanup());

  it("shows approved members the primary mobile routes and the full menu", () => {
    render(<MobileNavigation currentPath="/tree" isAdmin={false} onLogout={vi.fn()} />);

    expect(screen.getByRole("navigation", { name: "모바일 주요 탐색" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "믹스법" })).toHaveClass("bg-sky-700");
    expect(screen.getByRole("link", { name: "거래소" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "거래소" }).querySelector("span")).toHaveClass("whitespace-nowrap");

    fireEvent.click(screen.getByRole("button", { name: "전체 메뉴" }));
    expect(screen.getByRole("link", { name: "레벨계산기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "역산믹스법" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "레벨계산기" }).querySelector("span")).toHaveClass("whitespace-nowrap");
    expect(screen.queryByRole("link", { name: "관리자 대시보드" })).not.toBeInTheDocument();
  });

  it("shows the administrator dashboard only to administrators", () => {
    render(<MobileNavigation currentPath="/" isAdmin onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "전체 메뉴" }));
    expect(screen.getByRole("link", { name: "관리자 대시보드" })).toHaveAttribute("href", "/admin");
  });
});
