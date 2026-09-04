export type MonsterImageRecord = Record<string, unknown>;

function getMonsterImageStorageKey(imageUrl: unknown): string | null {
  if (typeof imageUrl !== "string") return null;
  if (imageUrl.startsWith("/manus-storage/")) return imageUrl.slice("/manus-storage/".length);
  if (!imageUrl.startsWith("/api/monster-image?")) return null;
  try {
    return new URL(imageUrl, "http://localhost").searchParams.get("key");
  } catch {
    return null;
  }
}

export function isSafeMonsterImageKey(key: string): boolean {
  return /^monster-images\/[^/]+\.webp$/i.test(key) && !key.includes("..") && !key.includes("\\");
}

export function isRegisteredMonsterImageKey(monsters: MonsterImageRecord[], key: string): boolean {
  if (!isSafeMonsterImageKey(key)) return false;
  return monsters.some((monster) => getMonsterImageStorageKey(monster.imageUrl) === key);
}

export function normalizeStoredMonsterImageUrls(monsters: MonsterImageRecord[]): MonsterImageRecord[] {
  return monsters.map((monster) => {
    const imageUrl = monster.imageUrl;
    if (typeof imageUrl !== "string" || !imageUrl.startsWith("/api/monster-image?")) return monster;
    try {
      const key = new URL(imageUrl, "http://localhost").searchParams.get("key");
      if (!key || !isSafeMonsterImageKey(key)) return monster;
      return { ...monster, imageUrl: `/manus-storage/${key}` };
    } catch {
      return monster;
    }
  });
}

export function protectMonsterImageUrls(monsters: unknown[]): unknown[] {
  return monsters.map((monster) => {
    if (!monster || typeof monster !== "object") return monster;
    const record = monster as MonsterImageRecord;
    const imageUrl = record.imageUrl;
    const key = getMonsterImageStorageKey(imageUrl);
    if (!key || !isSafeMonsterImageKey(key)) return monster;
    const imageVersion = typeof record.imageVersion === "number" || typeof record.imageVersion === "string"
      ? String(record.imageVersion).trim()
      : "";
    const query = new URLSearchParams({ key });
    if (imageVersion) query.set("v", imageVersion);
    return { ...record, imageUrl: `/api/monster-image?${query.toString()}` };
  });
}
