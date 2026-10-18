import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { loadMonsterData, mergeMonsterMetadata, saveMonsterData, setMonsterDataPoolForTesting } from "./monsterDataStore";

function createPool() {
  let stored: string | null = null;
  return {
    async query(sql: string, values: unknown[] = []) {
      if (sql.startsWith("SELECT data")) return [stored ? [{ data: stored }] : [], []];
      if (sql.startsWith("INSERT INTO monster_data_store")) {
        stored = String(values[1]);
        return [[], []];
      }
      throw new Error(`Unhandled query: ${sql}`);
    },
  };
}

describe("persistent monster data store", () => {
  afterEach(() => {
    setMonsterDataPoolForTesting(undefined);
  });

  it("uses the enabled persistent store and preserves uploaded image metadata", async () => {
    expect(process.env.MONSTER_DATA_STORE_ENABLED).toBe("true");
    const pool = createPool();
    setMonsterDataPoolForTesting(pool);
    const fallbackPath = "/tmp/mixmaster-monsters-store-test.json";
    const initial = [{ id: "1", name: "테스트", imageUrl: "/manus-storage/old.webp", imageVersion: 1_786_955_000_000 }];
    await saveMonsterData(initial, fallbackPath);
    const loaded = await loadMonsterData(fallbackPath);
    expect(loaded).toEqual(initial);
    const preserved = mergeMonsterMetadata([{ id: "1", name: "테스트" }], loaded)[0];
    expect(preserved.imageUrl).toBe("/manus-storage/old.webp");
    expect(preserved.imageVersion).toBe(1_786_955_000_000);
    expect(mergeMonsterMetadata([{ id: "1", name: "테스트", imageUrl: null }], loaded)[0].imageUrl).toBeNull();
  });

  it("persists the verified 트위스퉁가 득코 가능 correction in both server and fallback data", async () => {
    const pool = createPool();
    setMonsterDataPoolForTesting(pool);
    const fallbackPath = "/tmp/mixmaster-monsters-acquired-correction-test.json";
    await saveMonsterData([{ id: "twist", name: "트위스퉁가", acquired: "x" }], fallbackPath);

    await expect(loadMonsterData(fallbackPath)).resolves.toEqual([{ id: "twist", name: "트위스퉁가", acquired: "0" }]);
    expect(JSON.parse(fs.readFileSync(fallbackPath, "utf8"))).toEqual([{ id: "twist", name: "트위스퉁가", acquired: "0" }]);
  });
});
