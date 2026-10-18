import { describe, expect, it } from "vitest";
import { getRecipeIngredients, normalizeRecipeName, resolveRecipeMonster } from "./recipeResolver";

const monsters = [
  { id: "mirage", name: "미라쥬가오가몬" },
  { id: "baloo", name: "밸루" },
  { id: "antibi", name: "엔티비" },
  { id: "puffly", name: "퍼프리" },
  { id: "dark-puffly", name: "다크퍼프리" },
];

describe("recipe reference resolver", () => {
  it("normalizes validated historical recipe aliases before resolving a monster", () => {
    expect(normalizeRecipeName("미라주오가몬 [6]")).toBe("미라쥬가오가몬");
    expect(resolveRecipeMonster(monsters, "벨루 [5]")?.id).toBe("baloo");
    expect(resolveRecipeMonster(monsters, "안티비")?.id).toBe("antibi");
    expect(resolveRecipeMonster(monsters, "다크퍼브리 [2]")?.id).toBe("dark-puffly");
    expect(resolveRecipeMonster(monsters, "퍼블리 [2]")).toBeUndefined();
  });

  it("keeps unknown recipe names available for explicit missing-data display", () => {
    expect(resolveRecipeMonster(monsters, "빼빼양 ")).toBeUndefined();
    expect(getRecipeIngredients({ main: "재료", sub: "-", main2: "", sub2: null })).toEqual(["재료"]);
  });
});
