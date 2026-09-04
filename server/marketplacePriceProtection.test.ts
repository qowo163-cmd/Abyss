import { afterEach, describe, expect, it } from "vitest";
import {
  assertMarketplaceMinimumPrice,
  recordMarketplacePriceDropAlert,
  resetMarketplacePriceLine,
  setMarketplacePriceProtectionPoolForTesting,
} from "./marketplacePriceProtection";

function createPool() {
  const alerts: Array<Record<string, unknown>> = [];
  const executions: Array<{ sql: string; values: unknown[] }> = [];
  return {
    alerts,
    executions,
    pool: {
      async query(sql: string, values: unknown[] = []) {
        if (sql.includes("FROM marketplace_price_alerts WHERE")) {
          return [[...alerts.filter((alert) => alert.targetType === values[0] && alert.targetKey === values[1] && !alert.acknowledgedAt)], []] as never;
        }
        return [[], []] as never;
      },
      async execute(sql: string, values: unknown[] = []) {
        executions.push({ sql, values });
        if (sql.includes("INSERT INTO marketplace_price_alerts")) {
          alerts.push({ id: values[0], targetType: values[1], targetKey: values[2], acknowledgedAt: null });
        }
        return [{ affectedRows: 3 }, []] as never;
      },
    },
  };
}

describe("marketplace price protection", () => {
  afterEach(() => setMarketplacePriceProtectionPoolForTesting(undefined));

  it("blocks registrations under half of the reference price while allowing the exact 50 percent floor", () => {
    expect(() => assertMarketplaceMinimumPrice({ pricePerUnit: 49, referencePricePerUnit: 100, label: "자사 가격" })).toThrow(/50% 미만/);
    expect(() => assertMarketplaceMinimumPrice({ pricePerUnit: 50, referencePricePerUnit: 100, label: "자사 가격" })).not.toThrow();
    expect(() => assertMarketplaceMinimumPrice({ pricePerUnit: 1, referencePricePerUnit: null, label: "자사 가격" })).not.toThrow();
  });

  it("records one open administrator alert when the recent price drops by at least 30 percent", async () => {
    const { pool, alerts } = createPool();
    setMarketplacePriceProtectionPoolForTesting(pool as never);

    await recordMarketplacePriceDropAlert({ targetType: "hench", targetKey: "hench-1", targetName: "루루삐", baselineBoxesPerUnit: 100, recentAverageBoxesPerUnit: 70, source: "test" });
    await recordMarketplacePriceDropAlert({ targetType: "hench", targetKey: "hench-1", targetName: "루루삐", baselineBoxesPerUnit: 100, recentAverageBoxesPerUnit: 50, source: "test" });

    expect(alerts).toHaveLength(1);
  });

  it("restores only the selected initial price line from the preserved snapshot", async () => {
    const { pool, executions } = createPool();
    setMarketplacePriceProtectionPoolForTesting(pool as never);

    const result = await resetMarketplacePriceLine("admin-1", "hench-level-200-207");

    expect(result.affectedRows).toBe(3);
    expect(executions[0].sql).toContain("marketplace_initial_price_snapshots");
    expect(executions[0].values).toEqual(["admin-1", "hench-level-200-207"]);
  });
});
