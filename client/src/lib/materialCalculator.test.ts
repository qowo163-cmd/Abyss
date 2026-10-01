import { describe, expect, it } from "vitest";
import { calculateMaterialCounts, normalizeRecipeName } from "./materialCalculator";

const monsters = [
  { id: "target", name: "최종헨치", baseLevel: 220, main: "중간헨치 [5]", sub: "중간헨치 [5]" },
  { id: "middle", name: "중간헨치", baseLevel: 200, main: "레벨139재료", sub: "레벨140재료", main2: "레벨169재료", sub2: "레벨170재료" },
  { id: "level139", name: "레벨139재료", baseLevel: 139, main: "레벨140재료", sub: "-" },
  { id: "level140", name: "레벨140재료", baseLevel: 140, main: "-", sub: "-" },
  { id: "level169", name: "레벨169재료", baseLevel: 169, main: "-", sub: "-" },
  { id: "level170", name: "레벨170재료", baseLevel: 170, main: "-", sub: "-" },
];

describe("calculateMaterialCounts", () => {
  it("follows nested recipes and counts only 140~169 materials", () => {
    expect(calculateMaterialCounts(monsters, monsters[0])).toEqual({
      레벨140재료: 2,
      레벨169재료: 1,
    });
  });

  it("multiplies all calculated materials by the requested quantity", () => {
    expect(calculateMaterialCounts(monsters, monsters[0], 3)).toEqual({
      레벨140재료: 6,
      레벨169재료: 3,
    });
  });

  it("uses 140 and 169 as inclusive boundaries and excludes 139/170 from results", () => {
    const direct = {
      id: "target2",
      name: "직접재료테스트",
      baseLevel: 220,
      main: "레벨139재료",
      sub: "레벨169재료",
      main2: "레벨140재료",
      sub2: "레벨170재료",
    };
    expect(calculateMaterialCounts([...monsters, direct], direct)).toEqual({
      레벨140재료: 2,
      레벨169재료: 1,
    });
  });

  it("normalizes stage suffixes without relying on them as character levels", () => {
    expect(normalizeRecipeName(" 레벨140재료 [5] ")).toBe("레벨140재료");
  });
});
