import { describe, expect, it } from "vitest";
import monsters from "@/data/monsters.json";
import { calculateMaterialCounts } from "./materialCalculator";

describe("calculateMaterialCounts with current monster data", () => {
  it("returns level 170~179 materials for 군주가루곤킹", () => {
    const target = monsters.find((monster) => monster.name === "군주가루곤킹");
    expect(target).toBeDefined();

    const materials = calculateMaterialCounts(monsters, target!);
    const total = Object.values(materials).reduce((sum, count) => sum + count, 0);

    expect(total).toBeGreaterThan(0);
    expect(Object.keys(materials)).not.toContain("군주가루곤킹");
  });
});
