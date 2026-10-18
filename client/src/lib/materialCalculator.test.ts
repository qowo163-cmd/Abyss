import { describe, expect, it } from "vitest";
import {
  calculateMaterialCounts,
  collectRecipeChoices,
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

  it("counts obtainable 140~173 materials for the selected recipe", () => {
    expect(calculateMaterialCounts(monsters, monsters[0])).toEqual({
      레벨150재료: 1,
      레벨160재료: 1,
    });
  });


  it("uses 173 as an inclusive upper cap and expands obtainable ingredients above it", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, acquired: "x", main: "득코가능174 [1]", sub: "상한재료173 [1]" },
      { id: "obtainable174", name: "득코가능174", baseLevel: 174, acquired: "0", main: "재료170 [1]", sub: "재료160 [1]" },
      { id: "cap173", name: "상한재료173", baseLevel: 173, acquired: "0", main: "더낮은재료A [1]", sub: "더낮은재료B [1]" },
      { id: "m170", name: "재료170", baseLevel: 170, acquired: "0", main: "-", sub: "-" },
      { id: "m160", name: "재료160", baseLevel: 160, acquired: "0", main: "-", sub: "-" },
      { id: "lowerA", name: "더낮은재료A", baseLevel: 100, acquired: "0", main: "-", sub: "-" },
      { id: "lowerB", name: "더낮은재료B", baseLevel: 105, acquired: "0", main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(source, source[0])).toEqual({
      재료170: 1,
      재료160: 1,
      상한재료173: 1,
    });
  });

  it("uses the 140~173 fallback only when obtainability metadata is missing", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "경계173 [1]", sub: "초과174 [1]" },
      { id: "cap173", name: "경계173", baseLevel: 173, main: "하위A [1]", sub: "하위B [1]" },
      { id: "over174", name: "초과174", baseLevel: 174, main: "재료150 [1]", sub: "재료160 [1]" },
      { id: "a", name: "하위A", baseLevel: 90, main: "-", sub: "-" },
      { id: "b", name: "하위B", baseLevel: 90, main: "-", sub: "-" },
      { id: "m150", name: "재료150", baseLevel: 150, main: "-", sub: "-" },
      { id: "m160", name: "재료160", baseLevel: 160, main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(source, source[0])).toEqual({
      경계173: 1,
      재료150: 1,
      재료160: 1,
    });
  });

  it("continues through 174+ level intermediate monsters until reaching 140~173 materials", () => {
    const monsters = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "중간174 [3]", sub: "중간180 [3]" },
      { id: "middle174", name: "중간174", baseLevel: 174, main: "재료173 [3]", sub: "재료151 [3]" },
      { id: "middle180", name: "중간180", baseLevel: 180, main: "재료152 [3]", sub: "재료153 [3]" },
      { id: "m173", name: "재료173", baseLevel: 173, main: "-", sub: "-" },
      { id: "m151", name: "재료151", baseLevel: 151, main: "-", sub: "-" },
      { id: "m152", name: "재료152", baseLevel: 152, main: "-", sub: "-" },
      { id: "m153", name: "재료153", baseLevel: 153, main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(monsters, monsters[0])).toEqual({
      재료173: 1,
      재료151: 1,
      재료152: 1,
      재료153: 1,
    });
  });


  it("does not ask for a recipe choice for 140~173 final materials", () => {
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

  it("expands an unobtainable material into its sub-mix ingredients", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "득코불가헨치 [1]", sub: "일반재료 [1]" },
      { id: "blocked", name: "득코불가헨치", baseLevel: 150, acquired: "x", main: "하위재료A [1]", sub: "하위재료B [1]" },
      { id: "a", name: "하위재료A", baseLevel: 95, acquired: "0", main: "-", sub: "-" },
      { id: "b", name: "하위재료B", baseLevel: 100, acquired: "0", main: "-", sub: "-" },
      { id: "ordinary", name: "일반재료", baseLevel: 160, acquired: "0", main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(source, source[0])).toEqual({
      하위재료A: 1,
      하위재료B: 1,
      일반재료: 1,
    });
  });

  it("shows a monster without a sub-mix as a checkable material, regardless of level", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "네펠레맨 [1]", sub: "레벨150재료 [1]" },
      { id: "nephele", name: "네펠레맨", baseLevel: 95, acquired: "0", main: "-", sub: "-" },
      { id: "level150", name: "레벨150재료", baseLevel: 150, acquired: "0", main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(source, source[0])).toEqual({
      네펠레맨: 1,
      레벨150재료: 1,
    });
  });

  it("shows the selected monster itself when no recipe exists", () => {
    const source = [
      { id: "nephele", name: "네펠레맨", baseLevel: 95, acquired: "0", main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(source, source[0], 3)).toEqual({ 네펠레맨: 3 });
  });

  it("can offer recipe choices for an unobtainable final-level ingredient", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, main: "득코불가헨치 [1]", sub: "재료150 [1]" },
      { id: "blocked", name: "득코불가헨치", baseLevel: 150, acquired: "x", main: "하위A [1]", sub: "하위B [1]", main2: "하위C [1]", sub2: "하위D [1]" },
      { id: "m150", name: "재료150", baseLevel: 150, acquired: "0", main: "-", sub: "-" },
      { id: "a", name: "하위A", baseLevel: 90, main: "-", sub: "-" },
      { id: "b", name: "하위B", baseLevel: 90, main: "-", sub: "-" },
      { id: "c", name: "하위C", baseLevel: 90, main: "-", sub: "-" },
      { id: "d", name: "하위D", baseLevel: 90, main: "-", sub: "-" },
    ];

    expect(collectRecipeChoices(source, source[0]).map((monster) => monster.name)).toContain("득코불가헨치");
    expect(calculateMaterialCounts(source, source[0], 1, { blocked: 1 })).toEqual({
      하위C: 1,
      하위D: 1,
      재료150: 1,
    });
  });


  it("stops at the highest obtainable ingredient even when it has its own lower-level mix", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, acquired: "x", main: "득코불가중간 [1]", sub: "바로득코가능 [1]" },
      { id: "blocked", name: "득코불가중간", baseLevel: 180, acquired: "x", main: "최상위득코가능 [1]", sub: "믹스없는불가헨치 [1]" },
      { id: "top", name: "최상위득코가능", baseLevel: 95, acquired: "0", main: "더낮은재료A [1]", sub: "더낮은재료B [1]" },
      { id: "low-a", name: "더낮은재료A", baseLevel: 20, acquired: "0", main: "더아래A [1]", sub: "더아래B [1]" },
      { id: "low-b", name: "더낮은재료B", baseLevel: 30, acquired: "0", main: "더아래C [1]", sub: "더아래D [1]" },
      { id: "direct", name: "바로득코가능", baseLevel: 110, acquired: "0", main: "더낮은재료A [1]", sub: "더낮은재료B [1]" },
      { id: "terminal", name: "믹스없는불가헨치", baseLevel: 145, acquired: "x", main: "-", sub: "-" },
    ];

    expect(calculateMaterialCounts(source, source[0])).toEqual({
      최상위득코가능: 1,
      믹스없는불가헨치: 1,
      바로득코가능: 1,
    });
  });

  it("does not expose nested recipe choices below an obtainable ingredient", () => {
    const source = [
      { id: "target", name: "최종헨치", baseLevel: 220, acquired: "x", main: "득코불가중간 [1]", sub: "득코가능중간 [1]" },
      { id: "blocked", name: "득코불가중간", baseLevel: 180, acquired: "x", main: "A [1]", sub: "B [1]", main2: "C [1]", sub2: "D [1]" },
      { id: "available", name: "득코가능중간", baseLevel: 95, acquired: "0", main: "E [1]", sub: "F [1]", main2: "G [1]", sub2: "H [1]" },
      { id: "a", name: "A", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "b", name: "B", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "c", name: "C", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "d", name: "D", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "e", name: "E", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "f", name: "F", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "g", name: "G", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
      { id: "h", name: "H", baseLevel: 90, acquired: "0", main: "-", sub: "-" },
    ];

    expect(collectRecipeChoices(source, source[0]).map((monster) => monster.name)).toEqual(["득코불가중간"]);
  });

});
