import { describe, expect, it } from "vitest";
import { isRegisteredMonsterImageKey, isSafeMonsterImageKey, normalizeStoredMonsterImageUrls, protectMonsterImageUrls } from "./monsterImageUrls";

describe("monster image URL protection", () => {
  it("adds a cache-busting version to the protected URL for newly uploaded images", () => {
    expect(protectMonsterImageUrls([{
      id: "hench-1",
      imageUrl: "/manus-storage/monster-images/hench-1.webp",
      imageVersion: 1_786_955_000_000,
    }])).toEqual([{
      id: "hench-1",
      imageUrl: "/api/monster-image?key=monster-images%2Fhench-1.webp&v=1786955000000",
      imageVersion: 1_786_955_000_000,
    }]);
  });

  it("converts a saved protected URL back to its storage path before metadata persistence", () => {
    expect(normalizeStoredMonsterImageUrls([{
      id: "hench-1",
      imageUrl: "/api/monster-image?key=monster-images%2Fhench-1.webp&v=1786955000000",
      imageVersion: 1_786_955_000_000,
    }])).toEqual([{
      id: "hench-1",
      imageUrl: "/manus-storage/monster-images/hench-1.webp",
      imageVersion: 1_786_955_000_000,
    }]);
  });

  it("only accepts registered WebP keys under the monster-images storage namespace", () => {
    const monsters = [{ id: "hench-1", imageUrl: "/manus-storage/monster-images/hench-1_a1b2c3d4.webp" }];
    expect(isSafeMonsterImageKey("monster-images/hench-1_a1b2c3d4.webp")).toBe(true);
    expect(isSafeMonsterImageKey("../monster-images/hench-1.webp")).toBe(false);
    expect(isSafeMonsterImageKey("monster-images/hench-1.png")).toBe(false);
    expect(isRegisteredMonsterImageKey(monsters, "monster-images/hench-1_a1b2c3d4.webp")).toBe(true);
    expect(isRegisteredMonsterImageKey(monsters, "monster-images/other_a1b2c3d4.webp")).toBe(false);
  });
});
