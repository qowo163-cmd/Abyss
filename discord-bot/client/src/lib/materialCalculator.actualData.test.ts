import { describe, expect, it } from "vitest";
import monsters from "@/data/monsters.json";
import { calculateMaterialCounts, getRecipeOptions } from "./materialCalculator";

describe("calculateMaterialCounts with current monster data", () => {
  it("returns the highest obtainable materials and terminal no-recipe ingredients for 군주가루곤킹", () => {
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
      const isObtainableHighestMaterial = material.acquired === "0";
      const hasNoSubMix = getRecipeOptions(material).length === 0;
      expect(isObtainableHighestMaterial || hasNoSubMix).toBe(true);
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

  it("stops at the highest obtainable hench instead of expanding its lower mix", () => {
    const target = monsters.find((monster) => monster.name === "닌자걸");
    expect(target).toBeDefined();

    // 조합 2는 득코 가능한 데빌메쉬를 포함한다. 데빌메쉬 자체에 믹스법이 있어도
    // 그 아래 블루메탈/뉴봄버군까지 펼치지 않고 데빌메쉬를 체크 대상으로 유지해야 한다.
    const materials = calculateMaterialCounts(monsters, target!, 1, { [target!.id]: 1 });
    expect(materials["데스야누스"]).toBe(1);
    expect(materials["데빌메쉬"]).toBe(1);
    expect(materials).not.toHaveProperty("블루메탈");
    expect(materials).not.toHaveProperty("뉴봄버군");
  });

});
