import { describe, expect, it } from "vitest";
import { calculateMaterialCounts, normalizeRecipeName } from "./materialCalculator";

const monsters = [
  { id: "target", name: "최종헨치", baseLevel: 220, main: "중간헨치 [5]", sub: "중간헨치 [5]" },
  { id: "middle", name: "중간헨치", baseLevel: 200, main: "레벨170재료 [4]", sub: "레벨179재료 [4]", main2: "-", sub2: null },
  { id: "level170", name: "레벨170재료", baseLevel: 170, main: "-", sub: "-" },
  { id: "level179", name: "레벨179재료", baseLevel: 179, main: "-", sub: "-" },
];

describe("calculateMaterialCounts", () => {
  it("follows nested recipes and counts each 170~179 material", () => {
    expect(calculateMaterialCounts(monsters, monsters[0])).toEqual({
      레벨170재료: 2,
      레벨179재료: 2,
    });
  });

  it("multiplies all calculated materials by the requested quantity", () => {
    expect(calculateMaterialCounts(monsters, monsters[0], 3)).toEqual({
      레벨170재료: 6,
      레벨179재료: 6,
    });
  });

  it("normalizes stage suffixes without relying on them as character levels", () => {
    expect(normalizeRecipeName(" 레벨170재료 [5] ")).toBe("레벨170재료");
  });
});
