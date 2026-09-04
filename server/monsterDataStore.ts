import fs from "node:fs";
import mysql, { type Pool } from "mysql2/promise";
import { applyMonsterDataCorrections } from "./monsterDataCorrections.js";

const STORE_ID = "current";

type MonsterRecord = Record<string, unknown>;
type TestPool = Pick<Pool, "query">;

let pool: Pool | undefined;
let testPool: TestPool | undefined;

export function setMonsterDataPoolForTesting(nextPool: TestPool | undefined) {
  testPool = nextPool;
  pool = undefined;
}

function persistentStoreEnabled() {
  return process.env.MONSTER_DATA_STORE_ENABLED !== "false";
}

function getPool(): TestPool {
  if (testPool) return testPool;
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  pool = mysql.createPool(databaseUrl);
  return pool;
}

function readJsonFile(filePath: string): MonsterRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const value = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Array.isArray(value) ? applyMonsterDataCorrections(value as MonsterRecord[]) : [];
  } catch (error) {
    console.error("Failed to read monster fallback file:", error);
    return [];
  }
}

async function readDatabase(): Promise<MonsterRecord[] | null> {
  const [rows] = await getPool().query("SELECT data FROM monster_data_store WHERE id = ? LIMIT 1", [STORE_ID]);
  const raw = (rows as Array<{ data?: unknown }>)[0]?.data;
  if (typeof raw !== "string") return null;
  const value = JSON.parse(raw);
  return Array.isArray(value) ? applyMonsterDataCorrections(value as MonsterRecord[]) : null;
}

async function writeDatabase(monsters: MonsterRecord[]) {
  const corrected = applyMonsterDataCorrections(monsters);
  await getPool().query(
    "INSERT INTO monster_data_store (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP",
    [STORE_ID, JSON.stringify(corrected)],
  );
}

export async function loadMonsterData(fallbackPath: string): Promise<MonsterRecord[]> {
  if (persistentStoreEnabled() && (process.env.DATABASE_URL || testPool)) {
    try {
      const stored = await readDatabase();
      if (stored) return stored;
      const fallback = readJsonFile(fallbackPath);
      if (fallback.length > 0) {
        await writeDatabase(fallback);
      }
      return fallback;
    } catch (error) {
      console.error("Failed to read persistent monster data; using JSON fallback:", error);
    }
  }
  return readJsonFile(fallbackPath);
}

export async function saveMonsterData(monsters: MonsterRecord[], fallbackPath: string): Promise<void> {
  const corrected = applyMonsterDataCorrections(monsters);
  if (persistentStoreEnabled() && (process.env.DATABASE_URL || testPool)) {
    await writeDatabase(corrected);
  }
  try {
    fs.writeFileSync(fallbackPath, JSON.stringify(corrected, null, 2), "utf-8");
  } catch (error) {
    if (!persistentStoreEnabled() || (!process.env.DATABASE_URL && !testPool)) throw error;
    console.warn("Persistent monster data saved, but JSON development fallback could not be updated:", error);
  }
}

export function mergeMonsterMetadata(
  incoming: MonsterRecord[],
  current: MonsterRecord[],
): MonsterRecord[] {
  const byId = new Map(current.map((monster) => [String(monster.id || ""), monster]));
  const byName = new Map(current.map((monster) => [String(monster.name || "").trim().toLowerCase(), monster]));
  return incoming.map((monster) => {
    const previous = byId.get(String(monster.id || "")) || byName.get(String(monster.name || "").trim().toLowerCase());
    if (!previous) return monster;
    const next = { ...monster };
    const hasExplicitImageUrl = Object.prototype.hasOwnProperty.call(monster, "imageUrl");
    if (!hasExplicitImageUrl && typeof previous.imageUrl === "string" && previous.imageUrl.length > 0) {
      next.imageUrl = previous.imageUrl;
    }
    const hasExplicitImageVersion = Object.prototype.hasOwnProperty.call(monster, "imageVersion");
    if (!hasExplicitImageVersion && previous.imageVersion !== undefined) {
      next.imageVersion = previous.imageVersion;
    }
    return next;
  });
}
