/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { monsters } = vi.hoisted(() => ({
  monsters: [
    { id: "result", name: "다중조합헨치", main: "주재료[160]", sub: "부재료[161]", main2: "대체주재료[162]", sub2: "대체부재료[163]", attribute: "드래곤", baseLevel: 200, maxLevel: 225, imageUrl: "/monster.webp" },
    { id: "main", name: "주재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 160, maxLevel: 185 },
    { id: "sub", name: "부재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 161, maxLevel: 186 },
    { id: "alt-main", name: "대체주재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 162, maxLevel: 187 },
    { id: "alt-sub", name: "대체부재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 163, maxLevel: 188 },
  ],
}));

vi.mock("@/hooks/useMonsterData", () => ({ useMonsterData: () => monsters }));

import MaterialCalculator from "./MaterialCalculator";

describe("MaterialCalculator multiple recipes and saved tabs", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it("shows the compact multiple-recipe summary and both selectable recipes", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));

    expect(screen.getByText("주재료 / 대체주재료 + 부재료 / 대체부재료")).toBeInTheDocument();
    expect(screen.getByText("주재료")).toBeInTheDocument();
    expect(screen.getByText("대체주재료")).toBeInTheDocument();
  });

  it("recalculates materials when the second recipe is selected", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));

    await waitFor(() => expect(screen.getByText("주재료")).toBeInTheDocument());
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);

    expect(screen.getByText("대체주재료")).toBeInTheDocument();
    expect(screen.getByText("대체부재료")).toBeInTheDocument();
  });

  it("shows the general material list label and material quantity units", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));
    await waitFor(() => {
      expect(screen.getByText("필요 재료 목록")).toBeInTheDocument();
      expect(screen.getAllByText(/마리$/).length).toBeGreaterThan(0);
    });
  });

  it("shows a selected monster directly when it has no sub-mix recipe", async () => {
    monsters.push({ id: "leaf", name: "네펠레맨", main: "-", sub: "-", attribute: "짐승", baseLevel: 95, maxLevel: 120, acquired: "0" });
    try {
      render(<MaterialCalculator />);
      fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "네펠레맨" } });
      fireEvent.click(await screen.findByRole("button", { name: /네펠레맨/ }));

      expect(screen.getByText("필요 재료 목록")).toBeInTheDocument();
      expect(screen.getByText("네펠레맨", { selector: "button" })).toBeInTheDocument();
      expect(screen.getAllByText("1마리").length).toBeGreaterThan(0);
    } finally {
      monsters.pop();
    }
  });


  it("lists only the highest obtainable hench and does not list its lower mix ingredients", async () => {
    const main = monsters.find((monster) => monster.id === "main")!;
    const originalMain = { ...main };
    const lowerIngredients = [
      { id: "lower-a", name: "하위재료A", main: "더아래A", sub: "더아래B", attribute: "드래곤", baseLevel: 20, maxLevel: 40, acquired: "0" },
      { id: "lower-b", name: "하위재료B", main: "더아래C", sub: "더아래D", attribute: "드래곤", baseLevel: 30, maxLevel: 50, acquired: "0" },
    ];
    Object.assign(main, { acquired: "0", main: "하위재료A", sub: "하위재료B" });
    monsters.push(...lowerIngredients);

    try {
      render(<MaterialCalculator />);
      fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
      fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));

      expect(screen.getByRole("button", { name: "주재료" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "하위재료A" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "하위재료B" })).not.toBeInTheDocument();
    } finally {
      Object.assign(main, originalMain);
      monsters.splice(monsters.length - lowerIngredients.length, lowerIngredients.length);
    }
  });


  it("keeps independent calculator tabs and restores selections after remount", async () => {
    const firstRender = render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));
    fireEvent.click(screen.getByRole("button", { name: "제작 수량 증가" }));
    fireEvent.click((await screen.findAllByRole("checkbox"))[0]);

    expect(screen.getByTestId("material-calculator-quantity")).toHaveTextContent("2");
    expect((await screen.findAllByRole("checkbox"))[0]).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "재료계산기 탭 추가" }));
    expect(screen.getByRole("tab", { name: "탭 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("만들 헨치를 선택해 주세요")).toBeInTheDocument();

    firstRender.unmount();
    render(<MaterialCalculator />);

    expect(screen.getByRole("tab", { name: "다중조합헨치" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "탭 2" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "다중조합헨치" }));
    expect(screen.getByTestId("material-calculator-quantity")).toHaveTextContent("2");
    expect((await screen.findAllByRole("checkbox"))[0]).toBeChecked();

    const stored = JSON.parse(window.localStorage.getItem("abyss-material-calculator-tabs-v1") || "{}");
    expect(stored.tabs).toHaveLength(2);
    expect(stored.tabs[0].selectedMonster.name).toBe("다중조합헨치");
    expect(stored.tabs[0].quantity).toBe(2);
  });

});
