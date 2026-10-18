/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileHenchList from "./MobileHenchList";

vi.mock("@/hooks/useMonsterData", () => ({
  useMonsterData: () => Array.from({ length: 30 }, (_, index) => ({
    id: `mobile-${index}`, name: `모바일 헨치 ${index}`, attribute: "악마", baseLevel: index + 1, maxLevel: 99, acquired: "0",
  })),
}));
vi.mock("@/components/MonsterDetailModal", () => ({ MonsterDetailModal: () => null }));

describe("MobileHenchList", () => {
  it("renders a bounded first page and progressively shows more cards on demand", () => {
    render(<MobileHenchList />);

    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "30마리 중 24마리 표시")).toBeInTheDocument();
    expect(screen.getByText("모바일 헨치 23")).toBeInTheDocument();
    expect(screen.queryByText("모바일 헨치 24")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /헨치 더 보기/ }));
    expect(screen.getByText("모바일 헨치 29")).toBeInTheDocument();
  });
});
