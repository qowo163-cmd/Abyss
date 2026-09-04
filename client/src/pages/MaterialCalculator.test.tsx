/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { monsters } = vi.hoisted(() => ({
  monsters: [
    { id: "result", name: "엑셀조합결과헨치", main: "주재료[170]", sub: "부재료[171]", main2: "보조재료[175]", sub2: "추가재료[179]", attribute: "드래곤", baseLevel: 200, maxLevel: 225, imageUrl: "/manus-storage/monster-images/material-result.webp" },
    { id: "main", name: "주재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 170, maxLevel: 195 },
    { id: "sub", name: "부재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 171, maxLevel: 196 },
    { id: "secondary-main", name: "보조재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 175, maxLevel: 200 },
    { id: "secondary-sub", name: "추가재료", main: "-", sub: "-", attribute: "드래곤", baseLevel: 179, maxLevel: 204 },
  ],
}));

vi.mock("@/hooks/useMonsterData", () => ({ useMonsterData: () => monsters }));

import MaterialCalculator from "./MaterialCalculator";

describe("MaterialCalculator secondary ingredients", () => {
  afterEach(cleanup);

  it("includes main2 and sub2 materials from uploaded recipe data", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("헨치 이름 검색..."), { target: { value: "엑셀조합결과헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /엑셀조합결과헨치/ }));

    await waitFor(() => {
      expect(screen.getByText("보조재료")).toBeInTheDocument();
      expect(screen.getByText("추가재료")).toBeInTheDocument();
      expect(screen.getAllByAltText("드래곤")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ src: expect.stringContaining("/manus-storage/monster-images/material-result.webp") }),
        ]),
      );
    });
  });

  it("updates calculated quantities and remaining counts as materials are acquired", async () => {
    render(<MaterialCalculator />);
    fireEvent.change(screen.getByPlaceholderText("헨치 이름 검색..."), { target: { value: "엑셀조합결과헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /엑셀조합결과헨치/ }));

    await screen.findByText("보조재료");
    fireEvent.click(screen.getByRole("button", { name: "제작 수량 증가" }));

    await waitFor(() => expect(screen.getAllByText("2개")).toHaveLength(4));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getByText("구한 재료:").parentElement).toHaveTextContent("2개");
    expect(screen.getByText("남은 재료:").parentElement).toHaveTextContent("6개");
  });
});
