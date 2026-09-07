import mysql from "mysql2/promise";
import { MemberAuthError } from "./memberAuth.js";

type Db = mysql.Pool;
let pool: Db | undefined;
function db(): Db {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "업데이트 저장용 데이터베이스가 설정되지 않았습니다.");
  pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

export interface SiteUpdateItem {
  id: string;
  date: string;
  version: string;
  title: string;
  description: string;
  changes: string[];
  type: "feature" | "fix" | "improvement";
}

function rowToUpdate(row: Record<string, unknown>): SiteUpdateItem {
  let changes: string[] = [];
  try {
    const parsed = JSON.parse(String(row.changes ?? "[]"));
    if (Array.isArray(parsed)) changes = parsed.map(String);
  } catch {
    // 저장된 형식이 깨졌으면 빈 목록으로 처리합니다.
  }
  const type = row.type === "fix" || row.type === "improvement" ? row.type : "feature";
  return {
    id: String(row.id),
    date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
    version: String(row.version),
    title: String(row.title),
    description: String(row.description ?? ""),
    changes,
    type,
  };
}

// 이 테이블이 없으면 처음 한 번만 만들어줍니다. Railway처럼 매번 새 컨테이너로
// 배포되는 환경에서도, DB에 저장된 데이터는 배포와 상관없이 그대로 남아있어요.
let ensuredTable = false;
async function ensureTable() {
  if (ensuredTable) return;
  await db().query(`CREATE TABLE IF NOT EXISTS site_updates (
    id VARCHAR(64) PRIMARY KEY,
    date VARCHAR(64) NOT NULL,
    version VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    changes JSON,
    type VARCHAR(32) NOT NULL DEFAULT 'feature',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  ensuredTable = true;
}

export async function listSiteUpdates(): Promise<SiteUpdateItem[]> {
  await ensureTable();
  const [rows] = await db().query("SELECT * FROM site_updates ORDER BY date DESC");
  return (rows as Record<string, unknown>[]).map(rowToUpdate);
}

export async function upsertSiteUpdate(update: SiteUpdateItem): Promise<SiteUpdateItem[]> {
  await ensureTable();
  await db().query(
    `INSERT INTO site_updates (id, date, version, title, description, changes, type)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE date=VALUES(date), version=VALUES(version), title=VALUES(title), description=VALUES(description), changes=VALUES(changes), type=VALUES(type)`,
    [update.id, update.date, update.version, update.title, update.description, JSON.stringify(update.changes), update.type],
  );
  return listSiteUpdates();
}

export async function replaceSiteUpdates(updates: SiteUpdateItem[]): Promise<void> {
  await ensureTable();
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM site_updates");
    for (const update of updates) {
      await conn.query(
        `INSERT INTO site_updates (id, date, version, title, description, changes, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [update.id, update.date, update.version, update.title, update.description, JSON.stringify(update.changes ?? []), update.type],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
