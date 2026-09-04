// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonsterDetailModal } from "./MonsterDetailModal";

const monster = {
  id: "detail-test-1",
  name: "상세 테스트 헨치",
  baseLevel: 180,
  maxLevel: 200,
  habitat: "테스트 서식지",
  main: "재료A",
  sub: "재료B",
  main2: null,
  sub2: null,
  attribute: "드래곤",
  acquired: "0",
  xAntibody: 3,
  imageUrl: "/manus-storage/detail-test.webp",
};

describe("MonsterDetailModal", () => {
  afterEach(() => cleanup());

  it("uses the dedicated high-contrast detail card surface while preserving key monster information", () => {
    render(<MonsterDetailModal monster={monster} isOpen onClose={vi.fn()} allMonsters={[monster]} />);

    expect(screen.getByTestId("monster-detail-card")).toHaveClass("abyss-dim-card");
    expect(screen.getByText("Lv. 180 ~ 200")).toBeInTheDocument();
    expect(screen.getByText("테스트 서식지")).toBeInTheDocument();
    expect(screen.getByText("✓ 득코 가능").parentElement).toHaveClass("abyss-acquired-label");
    expect(screen.getByText("X데이터 3개 필요")).toHaveClass("text-xs");
    expect(screen.getByText("재료A")).toBeInTheDocument();
  });
});
