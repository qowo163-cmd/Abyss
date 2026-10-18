import { describe, expect, it } from "vitest";
import defaultMonsters from "@/data/monsters.json";
import { resolveMonsterType } from "./monsterType";

describe("resolveMonsterType", () => {
  it("keeps valid long/short labels", () => {
    expect(resolveMonsterType({ name: "예시", type: " 장코 " })).toBe("장코");
    expect(resolveMonsterType({ name: "예시", type: "단코" })).toBe("단코");
  });

  it("recovers missing labels from canonical hench data by ID", () => {
    const source = (defaultMonsters as Array<{ id: string; name: string; type: string }>).find((monster) => monster.type === "단코");
    expect(source).toBeTruthy();
    expect(resolveMonsterType({ id: source!.id, name: "이름이 달라도 ID가 같음" })).toBe("단코");
  });
});
