import { randomUUID } from "crypto";
import mysql, { type Pool } from "mysql2/promise";
import { MemberAuthError } from "./memberAuth.js";

export const MARKETPLACE_MINIMUM_PRICE_RATIO = 0.5;
export const MARKETPLACE_PRICE_DROP_ALERT_RATIO = 0.3;

type PriceAlertTargetType = "hench" | "item";
type DatabaseRow = Record<string, unknown>;
type MarketplacePool = Pick<Pool, "query" | "execute">;

export type MarketplacePriceAlert = {
  id: string;
  targetType: PriceAlertTargetType;
  targetKey: string;
  targetName: string;
  baselineBoxesPerUnit: number;
  recentAverageBoxesPerUnit: number;
  declinePercent: number;
  source: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

export type MarketplacePriceResetLine = {
  id: string;
  targetType: PriceAlertTargetType;
  title: string;
  description: string;
  initialBoxesPerUnit: number | null;
};

const RESET_LINES: MarketplacePriceResetLine[] = [
  { id: "hench-level-191-199", targetType: "hench", title: "191~199레벨", description: "초기 시세표 마리당 자사 15개", initialBoxesPerUnit: 15 },
  { id: "hench-level-200-207", targetType: "hench", title: "200~207레벨", description: "초기 시세표 마리당 자사 30개", initialBoxesPerUnit: 30 },
  { id: "hench-level-208-215", targetType: "hench", title: "208~215레벨", description: "초기 시세표 마리당 자사 35개", initialBoxesPerUnit: 35 },
  { id: "hench-level-216-223", targetType: "hench", title: "216~223레벨", description: "초기 시세표 마리당 자사 70개", initialBoxesPerUnit: 70 },
  { id: "hench-level-224-231", targetType: "hench", title: "224~231레벨", description: "초기 시세표 마리당 자사 150개", initialBoxesPerUnit: 150 },
  { id: "hench-level-232-239", targetType: "hench", title: "232~239레벨", description: "초기 시세표 마리당 자사 300개", initialBoxesPerUnit: 300 },
  { id: "hench-level-240", targetType: "hench", title: "240레벨", description: "초기 시세표 마리당 자사 600개", initialBoxesPerUnit: 600 },
  { id: "hench-immortal", targetType: "hench", title: "불멸 헨치", description: "초기 예외 시세표 마리당 자사 50개", initialBoxesPerUnit: 50 },
  { id: "hench-named-eight", targetType: "hench", title: "지정 8자사 헨치", description: "뉴·균형·네오·로엘 등 지정 헨치", initialBoxesPerUnit: 8 },
  { id: "hench-confirmed-eight", targetType: "hench", title: "균형핑크멀", description: "확정 예외 시세표 마리당 자사 8개", initialBoxesPerUnit: 8 },
  { id: "hench-confirmed-twenty", targetType: "hench", title: "지정 8종 헨치", description: "가루곤킹·아누비스 등 확정 예외", initialBoxesPerUnit: 20 },
  { id: "item-rage-souls", targetType: "item", title: "분노의 혼", description: "초기 기준가 및 최근 평균 기록을 새로 시작", initialBoxesPerUnit: null },
  { id: "item-rampage-souls", targetType: "item", title: "폭주의 혼", description: "초기 기준가 및 최근 평균 기록을 새로 시작", initialBoxesPerUnit: null },
  { id: "item-prism", targetType: "item", title: "프리즘", description: "초기 기준가 및 최근 평균 기록을 새로 시작", initialBoxesPerUnit: null },
];

let pool: Pool | undefined;
let testPool: MarketplacePool | undefined;

export function setMarketplacePriceProtectionPoolForTesting(nextPool: MarketplacePool | undefined) {
  testPool = nextPool;
  pool = undefined;
}

function getPool(): MarketplacePool {
  if (testPool) return testPool;
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "거래소 데이터베이스가 설정되지 않았습니다.");
  pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

function rows(result: unknown): DatabaseRow[] {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] as DatabaseRow[] : [];
}

function timestamp(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function alertFrom(row: DatabaseRow): MarketplacePriceAlert {
  return {
    id: String(row.id),
    targetType: row.targetType === "item" ? "item" : "hench",
    targetKey: String(row.targetKey),
    targetName: String(row.targetName),
    baselineBoxesPerUnit: Number(row.baselineBoxesPerUnit),
    recentAverageBoxesPerUnit: Number(row.recentAverageBoxesPerUnit),
    declinePercent: Number(row.declinePercent),
    source: String(row.source),
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
    acknowledgedAt: timestamp(row.acknowledgedAt),
    acknowledgedBy: row.acknowledgedBy ? String(row.acknowledgedBy) : null,
  };
}

export function assertMarketplaceMinimumPrice(input: { pricePerUnit: number; referencePricePerUnit: number | null; label: string }) {
  if (!input.referencePricePerUnit || input.referencePricePerUnit < 1) return;
  const minimum = Math.ceil(input.referencePricePerUnit * MARKETPLACE_MINIMUM_PRICE_RATIO);
  if (input.pricePerUnit < minimum) {
    throw new MemberAuthError("INVALID_INPUT", `${input.label}은 현재 평균 시세 마리당 ${input.referencePricePerUnit.toLocaleString("ko-KR")}개의 50% 미만으로 등록할 수 없습니다. 최소 마리당 ${minimum.toLocaleString("ko-KR")}개 이상으로 입력해 주세요.`);
  }
}

export async function recordMarketplacePriceDropAlert(input: { targetType: PriceAlertTargetType; targetKey: string; targetName: string; baselineBoxesPerUnit: number | null; recentAverageBoxesPerUnit: number | null; source: string }) {
  const baseline = input.baselineBoxesPerUnit;
  const recent = input.recentAverageBoxesPerUnit;
  if (!baseline || !recent || recent >= baseline) return null;
  const declinePercent = Math.floor(((baseline - recent) / baseline) * 100);
  if (declinePercent < MARKETPLACE_PRICE_DROP_ALERT_RATIO * 100) return null;
  const database = getPool();
  const open = await database.query(
    "SELECT id FROM marketplace_price_alerts WHERE target_type = ? AND target_key = ? AND acknowledged_at IS NULL LIMIT 1",
    [input.targetType, input.targetKey],
  );
  if (rows(open).length > 0) return null;
  const id = randomUUID();
  await database.execute(
    `INSERT INTO marketplace_price_alerts
      (id, target_type, target_key, target_name, baseline_boxes_per_unit, recent_average_boxes_per_unit, decline_percent, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.targetType, input.targetKey, input.targetName, baseline, recent, declinePercent, input.source],
  );
  return id;
}

export async function listMarketplacePriceAlerts(): Promise<MarketplacePriceAlert[]> {
  const result = await getPool().query(
    `SELECT id, target_type AS targetType, target_key AS targetKey, target_name AS targetName,
            baseline_boxes_per_unit AS baselineBoxesPerUnit, recent_average_boxes_per_unit AS recentAverageBoxesPerUnit,
            decline_percent AS declinePercent, source, created_at AS createdAt, acknowledged_at AS acknowledgedAt,
            acknowledged_by AS acknowledgedBy
     FROM marketplace_price_alerts ORDER BY acknowledged_at IS NULL DESC, created_at DESC LIMIT 100`,
  );
  return rows(result).map(alertFrom);
}

export async function acknowledgeMarketplacePriceAlert(administratorId: string, alertId: string) {
  const result = await getPool().execute(
    "UPDATE marketplace_price_alerts SET acknowledged_at = NOW(), acknowledged_by = ? WHERE id = ? AND acknowledged_at IS NULL",
    [administratorId, alertId],
  );
  const affectedRows = Array.isArray(result) && result[0] && typeof result[0] === "object" ? Number((result[0] as { affectedRows?: unknown }).affectedRows || 0) : 0;
  if (affectedRows === 0) throw new MemberAuthError("INVALID_INPUT", "확인할 수 있는 시세 알림이 아닙니다.");
  return { id: alertId, acknowledged: true };
}

export function listMarketplacePriceResetLines() {
  return RESET_LINES;
}

export async function resetMarketplacePriceLine(administratorId: string, lineId: unknown) {
  const line = RESET_LINES.find((candidate) => candidate.id === lineId);
  if (!line) throw new MemberAuthError("INVALID_INPUT", "초기화할 시세 라인을 선택해 주세요.");
  const database = getPool();
  const result = line.targetType === "hench"
    ? await database.execute(
      `UPDATE marketplace_price_baselines b
       INNER JOIN marketplace_initial_price_snapshots s ON s.target_type = 'hench' AND s.target_key = b.monster_id
       SET b.boxes_per_unit = s.initial_boxes_per_unit, b.updated_by = ?, b.updated_at = NOW()
       WHERE s.line_id = ?`,
      [administratorId, line.id],
    )
    : await database.execute(
      `UPDATE marketplace_item_catalog c
       INNER JOIN marketplace_initial_price_snapshots s ON s.target_type = 'item' AND s.target_key = c.id
       SET c.baseline_boxes_per_unit = s.initial_boxes_per_unit, c.updated_by = ?
       WHERE s.line_id = ?`,
      [administratorId, line.id],
    );
  const affectedRows = Array.isArray(result) && result[0] && typeof result[0] === "object" ? Number((result[0] as { affectedRows?: unknown }).affectedRows || 0) : 0;
  return { line, affectedRows };
}
