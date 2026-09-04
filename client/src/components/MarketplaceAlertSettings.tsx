import { BellRing, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMarketplaceAlertSettings, MARKETPLACE_ALERT_SETTINGS_EVENT, saveMarketplaceAlertSettings, type MarketplaceAlertSettings } from "@/lib/marketplaceAlertSettings";

export function MarketplaceAlertSettings({ compact = false }: { compact?: boolean }) {
  const [settings, setSettings] = useState<MarketplaceAlertSettings>(() => getMarketplaceAlertSettings());

  useEffect(() => {
    const refresh = () => setSettings(getMarketplaceAlertSettings());
    window.addEventListener(MARKETPLACE_ALERT_SETTINGS_EVENT, refresh);
    return () => window.removeEventListener(MARKETPLACE_ALERT_SETTINGS_EVENT, refresh);
  }, []);

  const update = (patch: Partial<MarketplaceAlertSettings>) => {
    setSettings(saveMarketplaceAlertSettings({ ...settings, ...patch }));
  };

  const requestBrowserPermission = async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
  };

  return (
    <details data-testid="marketplace-alert-settings" className={compact ? "rounded-2xl border border-sky-200 bg-white p-3" : "rounded-xl border border-sky-200 bg-white/75 p-3 shadow-sm shadow-sky-100/80"}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-extrabold text-sky-950 marker:hidden">
        <BellRing className="h-4 w-4 text-sky-700" /> 거래 요청 알림 설정
      </summary>
      <div className="mt-3 space-y-3 border-t border-sky-100 pt-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-slate-700">
          <span>알림 카드·알림음</span>
          <input aria-label="거래 요청 알림 켜기" type="checkbox" checked={settings.enabled} onChange={(event) => update({ enabled: event.target.checked })} className="h-4 w-4 accent-sky-700" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" />알림음 크기</span><span>{Math.round(settings.volume * 100)}%</span></span>
          <input aria-label="거래 요청 알림음 크기" disabled={!settings.enabled} type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => update({ volume: Number(event.target.value) })} className="mt-2 w-full accent-sky-700 disabled:opacity-45" />
        </label>
        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700"><input aria-label="브라우저 시스템 알림 켜기" type="checkbox" checked={settings.browserNotifications} onChange={(event) => update({ browserNotifications: event.target.checked })} className="h-4 w-4 accent-sky-700" /> 시스템 알림</label>
          {typeof Notification !== "undefined" && Notification.permission === "default" && <Button type="button" size="sm" variant="outline" onClick={() => void requestBrowserPermission()} className="h-7 border-sky-300 px-2 text-[11px] font-bold text-sky-800">권한 허용</Button>}
        </div>
        <p className="text-[11px] leading-4 text-slate-500">브라우저와 PC 앱은 이 설정을 따릅니다. Android의 시스템 알림음 크기는 기기 알림 음량 설정도 함께 적용됩니다.</p>
      </div>
    </details>
  );
}
