import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MemberAuthError } from "./memberAuth.js";

type Db = mysql.Pool;
let pool: Db | undefined;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGACY_UPDATES_PATH = path.resolve(__dirname, "..", "client", "src", "data", "updates.json");
let historyEnsured = false;
let automaticUpdatesRepaired = false;

export function readLegacyUpdates(): SiteUpdateItem[] {
  try {
    if (!fs.existsSync(LEGACY_UPDATES_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(LEGACY_UPDATES_PATH, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: any) => {
      if (!item || typeof item !== "object" || !item.id || !item.title) return [];
      const rawType = String(item.type || "feature");
      const type: SiteUpdateItem["type"] = rawType === "fix" || rawType === "improvement" ? rawType : "feature";
      const changes = Array.isArray(item.changes) ? item.changes.map(String).filter(Boolean) : [];
      return [{
        id: String(item.id),
        date: String(item.date || new Date().toISOString()),
        version: String(item.version || ""),
        title: String(item.title),
        description: String(item.description || ""),
        changes,
        type,
      } satisfies SiteUpdateItem];
    });
  } catch (error) {
    console.warn("Failed to read legacy update history:", error);
    return [];
  }
}

async function seedLegacyHistoryIfNeeded() {
  if (historyEnsured) return;
  const legacy = readLegacyUpdates();
  if (legacy.length === 0) {
    historyEnsured = true;
    return;
  }
  // Reconcile every legacy row as an insert-if-missing. This restores the public
  // history even when a previous admin save removed some rows from the DB.
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    for (const update of legacy) {
      await conn.query(
        `INSERT INTO site_updates (id, date, version, title, description, changes, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [update.id, update.date, update.version, update.title, update.description, JSON.stringify(update.changes), update.type],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  historyEnsured = true;
}

async function repairAutomaticUpdates() {
  if (automaticUpdatesRepaired) return;

  // Keep legacy automatic records readable even when the DB driver returns JSON
  // columns as native values. Avoid MySQL JSON_* functions so older schemas also work.
  try {
    const [rows] = await db().query(`SELECT id, version, date, title, description, changes, type FROM site_updates WHERE id LIKE 'railway-commit-%'`);
    const automaticRows = rows as Record<string, unknown>[];
    for (const row of automaticRows) {
      const id = String(row.id || "");
      const currentVersion = String(row.version || "");
      let changes: string[] = [];
      const raw = row.changes;
      if (Array.isArray(raw)) changes = raw.map(String).filter(Boolean);
      else if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) changes = parsed.map(String).filter(Boolean);
        } catch { /* keep fallback below */ }
      }
      if (id === 'railway-commit-70ccd15') {
        changes = [
          '헨치목록·믹스법·역산믹스법의 장코/단코 표시 보완',
          'Railway 배포가 성공한 경우에만 업데이트 내역 자동 등록',
          'GitHub 커밋 정보를 이용한 업데이트 제목·변경사항 자동 생성',
          '업데이트 탭의 실시간 SSE 반영 연결',
        ];
        await db().query(
          `UPDATE site_updates SET version=?, title=?, description=?, changes=?, type=? WHERE id=?`,
          [
            'v3.100.10',
            '장코/단코 표시 및 Railway 자동 업데이트 기록',
            '헨치 목록의 장코·단코 표시를 보완하고, Railway 배포 성공 시 업데이트 내역을 자동으로 기록하도록 연결했습니다.',
            JSON.stringify(changes),
            'improvement',
            id,
          ],
        );
        continue;
      }
      if (changes.length === 0) {
        const fallback = String(row.title || '사이트 업데이트').trim() || '사이트 업데이트';
        await db().query(
          `UPDATE site_updates SET changes=? WHERE id=?`,
          [JSON.stringify([`커밋 내용: ${fallback}`]), id],
        );
      }
      // Keep the public automatic history on the existing v3.100.x sequence.
      if (/^v1\./.test(currentVersion)) {
        // The next patch number is calculated from all current v3.100.x rows.
        const [currentRows] = await db().query(`SELECT version FROM site_updates WHERE version LIKE 'v3.100.%'`);
        let nextPatch = 9;
        for (const candidate of currentRows as Record<string, unknown>[]) {
          const match = String(candidate.version || '').match(/^v3\.100\.(\d+)$/);
          if (match) nextPatch = Math.max(nextPatch, Number(match[1]));
        }
        nextPatch += 1;
        await db().query(`UPDATE site_updates SET version=? WHERE id=?`, [`v3.100.${nextPatch}`, id]);
      }
    }
  } catch (error) {
    // Update history should never prevent the main site from starting.
    console.error('Failed to repair automatic update history:', error);
  }
  automaticUpdatesRepaired = true;
}

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
  const rawChanges = row.changes;
  if (Array.isArray(rawChanges)) {
    changes = rawChanges.map(String).filter(Boolean);
  } else if (rawChanges && typeof rawChanges === "object") {
    // mysql2 can return JSON columns as native arrays/objects depending on configuration.
    changes = Object.values(rawChanges as Record<string, unknown>).map(String).filter(Boolean);
  } else if (typeof rawChanges === "string") {
    try {
      const parsed = JSON.parse(rawChanges);
      if (Array.isArray(parsed)) changes = parsed.map(String).filter(Boolean);
      else if (parsed && typeof parsed === "object") changes = Object.values(parsed as Record<string, unknown>).map(String).filter(Boolean);
      else if (parsed != null) changes = [String(parsed)];
    } catch {
      changes = rawChanges.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    }
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
  await seedLegacyHistoryIfNeeded();
  await repairAutomaticUpdates();
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
