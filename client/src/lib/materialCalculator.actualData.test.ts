import { describe, expect, it } from "vitest";
import monsters from "@/data/monsters.json";
import { calculateMaterialCounts, getRecipeOptions } from "./materialCalculator";

describe("calculateMaterialCounts with current monster data", () => {
  it("returns only 140~169 level materials for 군주가루곤킹", () => {
    const target = monsters.find((monster) => monster.name === "군주가루곤킹");
    expect(target).toBeDefined();

    const materials = calculateMaterialCounts(monsters, target!);
    const total = Object.values(materials).reduce((sum, count) => sum + count, 0);

    expect(total).toBeGreaterThan(0);
    expect(Object.keys(materials)).not.toContain("군주가루곤킹");
    for (const name of Object.keys(materials)) {
      const material = monsters.find((monster) => monster.name === name);
      expect(material).toBeDefined();
      expect(Number(material?.baseLevel)).toBeGreaterThanOrEqual(140);
      expect(Number(material?.baseLevel)).toBeLessThanOrEqual(169);
    }
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
