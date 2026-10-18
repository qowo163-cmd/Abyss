import mysql, { type Pool } from "mysql2/promise";
import { MemberAuthError } from "./memberAuth.js";

export const MARKETPLACE_TABS = ["sell", "buy", "exchange", "items"] as const;
export type MarketplaceTab = (typeof MARKETPLACE_TABS)[number];
export type MarketplaceTabSettings = Record<`${MarketplaceTab}Enabled`, boolean> & { updatedAt: string | null };

type Row = Record<string, string | number | Date | null>;
type Db = Pick<Pool, "query" | "execute">;

const SETTINGS_ID = "primary";
const DEFAULT_SETTINGS: MarketplaceTabSettings = {
  sellEnabled: true,
  buyEnabled: true,
  exchangeEnabled: true,
  itemsEnabled: true,
  updatedAt: null,
};

let pool: Pool | undefined;
let testPool: Db | undefined;

function db(): Db {
  if (testPool) return testPool;
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "거래소 운영 설정 데이터베이스가 설정되지 않았습니다.");
  pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

function rows(result: unknown): Row[] {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] as Row[] : [];
}

function fromRow(row: Row | undefined): MarketplaceTabSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    sellEnabled: Number(row.sellEnabled) === 1,
    buyEnabled: Number(row.buyEnabled) === 1,
    exchangeEnabled: Number(row.exchangeEnabled) === 1,
    itemsEnabled: Number(row.itemsEnabled) === 1,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ? String(row.updatedAt) : null,
  };
}

export function setMarketplaceTabSettingsPoolForTesting(nextPool: Db | undefined) {
  testPool = nextPool;
  pool = undefined;
}

export async function getMarketplaceTabSettings(): Promise<MarketplaceTabSettings> {
  const result = await db().query(
    "SELECT sell_enabled AS sellEnabled, buy_enabled AS buyEnabled, exchange_enabled AS exchangeEnabled, items_enabled AS itemsEnabled, updated_at AS updatedAt FROM marketplace_tab_settings WHERE id = ? LIMIT 1",
    [SETTINGS_ID],
  );
  return fromRow(rows(result)[0]);
}

export async function saveMarketplaceTabSettings(updatedBy: string, input: Partial<Record<`${MarketplaceTab}Enabled`, unknown>>): Promise<MarketplaceTabSettings> {
  const current = await getMarketplaceTabSettings();
  const next: MarketplaceTabSettings = {
    ...current,
    ...Object.fromEntries(MARKETPLACE_TABS.map((tab) => {
      const key = `${tab}Enabled` as const;
      return [key, typeof input[key] === "boolean" ? input[key] : current[key]];
    })),
  } as MarketplaceTabSettings;

  await db().execute(
    "INSERT INTO marketplace_tab_settings (id, sell_enabled, buy_enabled, exchange_enabled, items_enabled, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE sell_enabled = VALUES(sell_enabled), buy_enabled = VALUES(buy_enabled), exchange_enabled = VALUES(exchange_enabled), items_enabled = VALUES(items_enabled), updated_by = VALUES(updated_by)",
    [SETTINGS_ID, Number(next.sellEnabled), Number(next.buyEnabled), Number(next.exchangeEnabled), Number(next.itemsEnabled), updatedBy],
  );
  return getMarketplaceTabSettings();
}
