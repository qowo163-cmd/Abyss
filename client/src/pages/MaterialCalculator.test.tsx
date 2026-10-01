/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { monsters } = vi.hoisted(() => ({
  monsters: [
    {
      id: "result",
      name: "다중조합헨치",
      main: "주재료[160]",
      sub: "부재료[161]",
      main2: "대체주재료[162]",
      sub2: "대체부재료[163]",
      attribute: "드래곤",
      baseLevel: 200,
      maxLevel: 225,
      habitat: "테스트 서식지",
      acquired: "x",
      imageUrl: "/monster.webp",
    },
    {
      id: "main",
      name: "주재료",
      main: "하위1",
      sub: "하위2",
      attribute: "드래곤",
      baseLevel: 160,
      maxLevel: 185,
      habitat: "테스트 사냥터 1, 테스트 사냥터 2",
      acquired: "0",
    },
    { id: "sub", name: "부재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 161, maxLevel: 186, habitat: "테스트 사냥터 3", acquired: "x" },
    { id: "alt-main", name: "대체주재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 162, maxLevel: 187, habitat: "대체 사냥터", acquired: "0" },
    { id: "alt-sub", name: "대체부재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 163, maxLevel: 188, habitat: "대체 사냥터 2", acquired: "x" },
    { id: "하위1", name: "하위1", main: "-", sub: "-", attribute: "드래곤", baseLevel: 80, maxLevel: 105, habitat: "하위 서식지", acquired: "0" },
    { id: "하위2", name: "하위2", main: "-", sub: "-", attribute: "드래곤", baseLevel: 81, maxLevel: 106, habitat: "하위 서식지 2", acquired: "0" },
  ],
}));

vi.mock("@/hooks/useMonsterData", () => ({ useMonsterData: () => monsters }));

import MaterialCalculator from "./MaterialCalculator";

describe("MaterialCalculator", () => {
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

  it("shows material details with acquisition status, habitat, and mix recipes when a material is clicked", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));

    const materialButton = await screen.findByRole("button", { name: /주재료 상세정보 열기/ });
    fireEvent.click(materialButton);

    expect(screen.getByText("✓ 득코 가능")).toBeInTheDocument();
    expect(screen.getByText("테스트 사냥터 1")).toBeInTheDocument();
    expect(screen.getByText("테스트 사냥터 2")).toBeInTheDocument();
    expect(screen.getByText("믹스법")).toBeInTheDocument();
    expect(screen.getByText("하위1")).toBeInTheDocument();
    expect(screen.getByText("하위2")).toBeInTheDocument();
  });

  it("shows 득코 불가능 for an unavailable material", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));
    await waitFor(() => expect(screen.getByText("부재료")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /부재료 상세정보 열기/ }));
    expect(screen.getByText("✕ 득코 불가능")).toBeInTheDocument();
  });

  it("keeps the 140~169 label and material quantity units", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("만들 헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));
    await waitFor(() => {
      expect(screen.getByText("140~169 레벨 재료")).toBeInTheDocument();
      expect(screen.getAllByText(/마리$/).length).toBeGreaterThan(0);
    });
  });
});
