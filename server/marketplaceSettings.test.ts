import { afterEach, describe, expect, it } from "vitest";
import type { PublicMember } from "./memberAuth";
import { assertMarketplaceTabAccess } from "./marketplaceAccess";
import { getMarketplaceTabSettings, saveMarketplaceTabSettings, setMarketplaceTabSettingsPoolForTesting } from "./marketplaceSettings";

const member = (role: PublicMember["role"]): PublicMember => ({
  id: `${role}-member`, username: role, nickname: role, discordNickname: role, gameNickname: role,
  role, status: "approved", approvedAt: new Date().toISOString(), lastActivityAt: null, createdAt: new Date().toISOString(),
});

function createSettingsPool() {
  let row: Record<string, unknown> | undefined;
  return {
    pool: {
      async query(sql: string) {
        if (!sql.includes("FROM marketplace_tab_settings")) throw new Error(`Unhandled query: ${sql}`);
        return [row ? [row] : [], []];
      },
      async execute(sql: string, values: unknown[]) {
        if (!sql.includes("INSERT INTO marketplace_tab_settings")) throw new Error(`Unhandled execute: ${sql}`);
        row = { sellEnabled: values[1], buyEnabled: values[2], exchangeEnabled: values[3], itemsEnabled: values[4], updatedAt: new Date() };
        return [{ affectedRows: 1 }, []];
      },
    },
  };
}

describe("marketplace tab settings", () => {
  afterEach(() => setMarketplaceTabSettingsPoolForTesting(undefined));

  it("uses every tab by default and persists individual administrator switches", async () => {
    const { pool } = createSettingsPool();
    setMarketplaceTabSettingsPoolForTesting(pool as never);

    await expect(getMarketplaceTabSettings()).resolves.toMatchObject({ sellEnabled: true, buyEnabled: true, exchangeEnabled: true, itemsEnabled: true });
    await expect(saveMarketplaceTabSettings("admin-1", { sellEnabled: false, itemsEnabled: false })).resolves.toMatchObject({ sellEnabled: false, buyEnabled: true, exchangeEnabled: true, itemsEnabled: false });
  });

  it("blocks a regular member from a disabled tab while allowing administrators to manage it", async () => {
    const { pool } = createSettingsPool();
    setMarketplaceTabSettingsPoolForTesting(pool as never);
    await saveMarketplaceTabSettings("admin-1", { exchangeEnabled: false });

    await expect(assertMarketplaceTabAccess(member("member"), "exchange")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertMarketplaceTabAccess(member("admin"), "exchange")).resolves.toBeUndefined();
  });
});
