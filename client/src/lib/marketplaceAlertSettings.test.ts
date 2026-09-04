import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKETPLACE_ALERT_SETTINGS, getMarketplaceAlertSettings, saveMarketplaceAlertSettings } from "./marketplaceAlertSettings";

describe("marketplace alert settings", () => {
  it("uses audible alerts by default and clamps saved volume", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });

    expect(getMarketplaceAlertSettings()).toEqual(DEFAULT_MARKETPLACE_ALERT_SETTINGS);
    expect(saveMarketplaceAlertSettings({ enabled: true, volume: 5, browserNotifications: false })).toEqual({ enabled: true, volume: 1, browserNotifications: false });
  });
});
