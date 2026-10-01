/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("MaterialCalculator multiple recipes", () => {
  afterEach(cleanup);

  it("shows the compact multiple-recipe summary and both selectable recipes", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));

    expect(screen.getByText("주재료 / 대체주재료 + 부재료 / 대체부재료")).toBeInTheDocument();
    expect(screen.getByText("주재료")).toBeInTheDocument();
    expect(screen.getByText("대체주재료")).toBeInTheDocument();
  });

  it("recalculates materials when the second recipe is selected", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));

    await waitFor(() => expect(screen.getByText("주재료")).toBeInTheDocument());
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);

    expect(screen.getByText("대체주재료")).toBeInTheDocument();
    expect(screen.getByText("대체부재료")).toBeInTheDocument();
  });

  it("keeps the 140~169 label and material quantity units", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("헨치 이름 검색..."), { target: { value: "다중조합헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /다중조합헨치/ }));
    await waitFor(() => {
      expect(screen.getByText("140~169 레벨 재료")).toBeInTheDocument();
      expect(screen.getAllByText(/마리$/).length).toBeGreaterThan(0);
    });
  });
});
