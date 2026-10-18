export type MarketplaceAlertSettings = {
  enabled: boolean;
  volume: number;
  browserNotifications: boolean;
};

const STORAGE_KEY = "abyss-marketplace-alert-settings";
export const MARKETPLACE_ALERT_SETTINGS_EVENT = "marketplace-alert-settings-updated";

export const DEFAULT_MARKETPLACE_ALERT_SETTINGS: MarketplaceAlertSettings = {
  enabled: true,
  volume: 0.82,
  browserNotifications: true,
};

function normalizeSettings(value: unknown): MarketplaceAlertSettings {
  const candidate = value && typeof value === "object" ? value as Partial<MarketplaceAlertSettings> : {};
  const numericVolume = Number(candidate.volume);
  return {
    enabled: candidate.enabled !== false,
    volume: Number.isFinite(numericVolume) ? Math.max(0, Math.min(1, numericVolume)) : DEFAULT_MARKETPLACE_ALERT_SETTINGS.volume,
    browserNotifications: candidate.browserNotifications !== false,
  };
}

export function getMarketplaceAlertSettings(): MarketplaceAlertSettings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return DEFAULT_MARKETPLACE_ALERT_SETTINGS;
  }
}

export function saveMarketplaceAlertSettings(next: MarketplaceAlertSettings): MarketplaceAlertSettings {
  const normalized = normalizeSettings(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(MARKETPLACE_ALERT_SETTINGS_EVENT));
  return normalized;
}
