import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type MonsterRecipe = {
  name: string;
  main?: string;
  sub?: string;
  main2?: string;
  sub2?: string;
};

describe("stored monster recipes", () => {
  it("keeps the verified dark pupuri and harpy ingredients for 스콜피온킹", () => {
    const raw = readFileSync(resolve(process.cwd(), "client/src/data/monsters.json"), "utf8");
    const monsters = JSON.parse(raw) as MonsterRecipe[];
    const scorpionKing = monsters.find((monster) => monster.name === "스콜피온킹");

    expect(scorpionKing).toMatchObject({
      main: "라운드비틀 [3] ",
      sub: "뉴미스터락 [3] ",
      main2: "다크퍼프리 [2]",
      sub2: "하피 [2]",
    });
  });

  it("keeps all 뉴아르카나 variant materials at the verified 6-stage level", () => {
    const raw = readFileSync(resolve(process.cwd(), "client/src/data/monsters.json"), "utf8");
    const monsters = JSON.parse(raw) as MonsterRecipe[];
    const expectedMaterials = new Map([
      ["뉴아르카나드래곤", "아르카나드래곤"],
      ["뉴아르카나짐승", "아르카나짐승"],
      ["뉴아르카나곤충", "아르카나곤충"],
      ["뉴아르카나메탈", "아르카나메탈"],
      ["뉴아르카나미스터리", "아르카나미스터리"],
      ["뉴아르카나새", "아르카나새"],
      ["뉴아르카나식물", "아르카나식물"],
      ["뉴아르카나악마", "아르카나악마"],
    ]);

    for (const [name, material] of expectedMaterials) {
      expect(monsters.find((monster) => monster.name === name)).toMatchObject({
        main: `${material} [6]`,
        sub: `${material} [6]`,
      });
    }
  });

  it("keeps both 뉴기와장군 materials at the verified 5-stage level", () => {
    const raw = readFileSync(resolve(process.cwd(), "client/src/data/monsters.json"), "utf8");
    const monsters = JSON.parse(raw) as MonsterRecipe[];
    const newRoofGeneral = monsters.find((monster) => monster.name === "뉴기와장군");

    expect(newRoofGeneral).toMatchObject({
      main: "기와장군 [5]",
      sub: "커터맨티스 [5]",
    });
  });

  it("keeps 블루메탈 at 2-stage and the 매드카우 material order verified", () => {
    const raw = readFileSync(resolve(process.cwd(), "client/src/data/monsters.json"), "utf8");
    const monsters = JSON.parse(raw) as MonsterRecipe[];

    expect(monsters.find((monster) => monster.name === "데빌메쉬")).toMatchObject({ main: "블루메탈 [2]" });
    expect(monsters.find((monster) => monster.name === "매드카우")).toMatchObject({
      main: "밀크카우 [3]",
      sub: "올드매지션 [3]",
    });
  });

  it("keeps all explicit recipe stages in the supported 1-to-7 range without duplicate-material conflicts", () => {
    const raw = readFileSync(resolve(process.cwd(), "client/src/data/monsters.json"), "utf8");
    const monsters = JSON.parse(raw) as MonsterRecipe[];
    const stagePattern = /^(.*?)\s*\[(\d+)]\s*$/;

    for (const monster of monsters) {
      const seenStages = new Map<string, number>();
      for (const field of ["main", "sub", "main2", "sub2"] as const) {
        const value = monster[field]?.trim() ?? "";
        if (!value || value === "-") continue;
        const match = value.match(stagePattern);
        if (!match) continue;
        const material = match[1]?.trim() ?? "";
        const stage = Number(match[2]);
        expect(stage).toBeGreaterThanOrEqual(1);
        expect(stage).toBeLessThanOrEqual(7);
        if (seenStages.has(material)) expect(seenStages.get(material)).toBe(stage);
        seenStages.set(material, stage);
      }
    }
  });
});
