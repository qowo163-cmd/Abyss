import { describe, expect, it } from "vitest";
import {
  calculateMaterialCounts,
  getRecipeOptions,
  normalizeRecipeName,
} from "./materialCalculator";

const monsters = [
  { id: "target", name: "최종헨치", baseLevel: 220, main: "중간헨치 [5]", sub: "중간헨치 [5]", main2: "대체중간 [5]", sub2: "대체중간2 [5]" },
  { id: "middle", name: "중간헨치", baseLevel: 180, main: "레벨150재료 [4]", sub: "레벨160재료 [4]", main2: "레벨151재료 [4]", sub2: "레벨161재료 [4]" },
  { id: "middle-alt", name: "대체중간", baseLevel: 180, main: "레벨151재료 [4]", sub: "레벨161재료 [4]" },
  { id: "middle-alt2", name: "대체중간2", baseLevel: 180, main: "레벨152재료 [4]", sub: "레벨162재료 [4]" },
  { id: "level150", name: "레벨150재료", baseLevel: 150, main: "-", sub: "-" },
  { id: "level160", name: "레벨160재료", baseLevel: 160, main: "-", sub: "-" },
  { id: "level151", name: "레벨151재료", baseLevel: 151, main: "-", sub: "-" },
  { id: "level161", name: "레벨161재료", baseLevel: 161, main: "-", sub: "-" },
  { id: "level152", name: "레벨152재료", baseLevel: 152, main: "-", sub: "-" },
  { id: "level162", name: "레벨162재료", baseLevel: 162, main: "-", sub: "-" },
];

describe("material calculator recipes", () => {
  it("normalizes stage suffixes", () => {
    expect(normalizeRecipeName(" 레벨150재료 [5] ")).toBe("레벨150재료");
  });

  it("treats main/sub and main2/sub2 as two alternative recipes", () => {
    const options = getRecipeOptions(monsters[0]);
    expect(options).toEqual([
      { index: 0, main: "중간헨치", sub: "중간헨치" },
      { index: 1, main: "대체중간", sub: "대체중간2" },
    ]);
  });

  it("counts only 140~169 materials for the selected recipe", () => {
    expect(calculateMaterialCounts(monsters, monsters[0])).toEqual({
      레벨150재료: 1,
      레벨160재료: 1,
    });
  });


  it("continues through 170+ level intermediate monsters until reaching 140~169 materials", () => {
    const monsters = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "중간170 [3]", sub: "중간180 [3]" },
      { id: "middle170", name: "중간170", baseLevel: 170, main: "재료150 [3]", sub: "재료151 [3]" },
      { id: "middle180", name: "중간180", baseLevel: 180, main: "재료152 [3]", sub: "재료153 [3]" },
      { id: "m150", name: "재료150", baseLevel: 150, main: "-", sub: "-" },
      { id: "m151", name: "재료151", baseLevel: 151, main: "-", sub: "-" },
      { id: "m152", name: "재료152", baseLevel: 152, main: "-", sub: "-" },
      { id: "m153", name: "재료153", baseLevel: 153, main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(monsters, monsters[0])).toEqual({
      재료150: 1,
      재료151: 1,
      재료152: 1,
      재료153: 1,
    });
  });


  it("does not ask for a recipe choice for 140~169 final materials", () => {
    const monsters = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "재료150 [3]", sub: "재료151 [3]" },
      { id: "m150", name: "재료150", baseLevel: 150, main: "하위1 [2]", sub: "하위2 [2]", main2: "하위3 [2]", sub2: "하위4 [2]" },
      { id: "m151", name: "재료151", baseLevel: 151, main: "-", sub: "-" },
    ];

    expect(collectRecipeChoices(monsters, monsters[0])).toEqual([]);
  });

  it("uses the second recipe when the user selects it", () => {
    expect(calculateMaterialCounts(monsters, monsters[0], 2, { target: 1 })).toEqual({
      레벨151재료: 2,
      레벨161재료: 2,
    });
  });

  it("follows a nested recipe selection for a lower-level intermediate", () => {
    expect(calculateMaterialCounts(monsters, monsters[0], 1, { target: 0, middle: 1 })).toEqual({
      레벨151재료: 1,
      레벨161재료: 1,
    });
  });
});
