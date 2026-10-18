/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { monsters } = vi.hoisted(() => ({
  monsters: [
    { id: "ingredient", name: "보조재료헨치", main: "-", sub: "-", main2: null, sub2: null, attribute: "드래곤", baseLevel: 170, maxLevel: 195, acquired: "0", imageUrl: "/manus-storage/monster-images/ingredient.webp" },
    { id: "recipe", name: "보조재료조합헨치", main: "주재료[170]", sub: "부재료[170]", main2: "보조재료헨치[175]", sub2: "-", attribute: "드래곤", baseLevel: 180, maxLevel: 205, acquired: "0", imageUrl: "/manus-storage/monster-images/recipe.webp" },
  ],
}));

vi.mock("@/hooks/useMonsterData", () => ({ useMonsterData: () => monsters }));

import ReverseRecipe from "./ReverseRecipe";

describe("ReverseRecipe secondary ingredients", () => {
  it("recognizes an uploaded recipe that uses main2 or sub2", async () => {
    render(<ReverseRecipe />);
    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), { target: { value: "보조재료헨치" } });
    fireEvent.click(await screen.findByRole("button", { name: /보조재료헨치/ }));

    await waitFor(() => {
      expect(screen.getByText("보조재료조합헨치")).toBeInTheDocument();
      expect(screen.getAllByAltText("드래곤")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ src: expect.stringContaining("/manus-storage/monster-images/ingredient.webp") }),
        ]),
      );
    });
  });
});
