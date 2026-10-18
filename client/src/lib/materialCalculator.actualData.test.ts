import { describe, expect, it } from "vitest";
import monsters from "@/data/monsters.json";
import { calculateMaterialCounts, getRecipeOptions } from "./materialCalculator";

describe("calculateMaterialCounts with current monster data", () => {
  it("returns final obtainable 140~169 materials and terminal no-recipe ingredients for 군주가루곤킹", () => {
    const target = monsters.find((monster) => monster.name === "군주가루곤킹");
    expect(target).toBeDefined();

    const materials = calculateMaterialCounts(monsters, target!);
    const total = Object.values(materials).reduce((sum, count) => sum + count, 0);

    expect(total).toBeGreaterThan(0);
    expect(Object.keys(materials)).not.toContain("군주가루곤킹");
    for (const name of Object.keys(materials)) {
      const material = monsters.find((monster) => monster.name === name);
      // Some legacy recipes refer to a material whose monster record is not in the current dataset;
      // it should still remain visible as a terminal checklist item rather than disappear.
      if (!material) continue;
      const level = Number(material.baseLevel);
      const isObtainableFinalMaterial = level >= 140 && level <= 169 && material.acquired !== "x";
      const hasNoSubMix = getRecipeOptions(material).length === 0;
      expect(isObtainableFinalMaterial || hasNoSubMix).toBe(true);
    }
  });

  it("keeps 네펠레맨 visible as a required ingredient when its recipe branch is selected", () => {
    const target = monsters.find((monster) => monster.name === "뉴오르데빌");
    expect(target).toBeDefined();
    const options = getRecipeOptions(target!);
    expect(options.some((option) => option.index === 1 && option.sub === "네펠레맨")).toBe(true);

    const materials = calculateMaterialCounts(monsters, target!, 1, { [target!.id]: 1 });
    expect(materials["네펠레맨"]).toBe(1);
  });

  it("exposes multiple recipes such as 닌자걸", () => {
    const target = monsters.find((monster) => monster.name === "닌자걸");
    expect(target).toBeDefined();
    const options = getRecipeOptions(target!);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ main: "퍼플데블윙", sub: "뉴라운드비틀" });
    expect(options[1]).toMatchObject({ main: "데스야누스", sub: "데빌메쉬" });
  });
});
