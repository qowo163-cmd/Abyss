import { BellRing, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import type { MarketplaceRequestAlert } from "@shared/marketplaceRequestAlerts";
import { getMarketplaceAlertSettings, MARKETPLACE_ALERT_SETTINGS_EVENT, type MarketplaceAlertSettings } from "@/lib/marketplaceAlertSettings";

type DesktopBridge = { showNotification?: (payload: { title: string; body: string; volume: number }) => void };
type AndroidPushTokenBridgePayload = { token: string; enabled?: boolean };
export const MARKETPLACE_ALERT_TEST_EVENT = "abyss:marketplace-alert-test";

declare global {
  interface Window {
    abyssDesktop?: DesktopBridge;
    ReactNativeWebView?: { postMessage: (message: string) => void };
    abyssAndroidPushToken?: AndroidPushTokenBridgePayload;
  }
}

function playChime(volume: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass || volume <= 0) return;
    const context = new AudioContextClass();
    const start = context.currentTime;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(Math.min(0.42, Math.max(0.08, volume * 0.5)), start);
    masterGain.connect(context.destination);
    void context.resume().catch(() => undefined);
    [
      { offset: 0, frequency: 740, duration: 0.13, type: "triangle" as OscillatorType },
      { offset: 0.15, frequency: 1047, duration: 0.18, type: "sine" as OscillatorType },
      { offset: 0.39, frequency: 1319, duration: 0.2, type: "sine" as OscillatorType },
    ].forEach(({ offset, frequency, duration, type }) => {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();
      const toneStart = start + offset;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, toneStart);
      toneGain.gain.setValueAtTime(0.0001, toneStart);
      toneGain.gain.exponentialRampToValueAtTime(1, toneStart + 0.015);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
      oscillator.connect(toneGain);
      toneGain.connect(masterGain);
      oscillator.start(toneStart);
      oscillator.stop(toneStart + duration + 0.02);
    });
    window.setTimeout(() => void context.close(), 850);
  } catch {
    // The browser may block audio until a user interaction. The visual card remains available.
  }
}

export function MarketplaceRequestNotifier({ memberId }: { memberId: string | null }) {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<MarketplaceAlertSettings>(() => getMarketplaceAlertSettings());
  const [alert, setAlert] = useState<MarketplaceRequestAlert | null>(null);
  const seenAlertIds = useRef(new Set<string>());

  useEffect(() => {
    const refresh = () => setSettings(getMarketplaceAlertSettings());
    window.addEventListener(MARKETPLACE_ALERT_SETTINGS_EVENT, refresh);
    return () => window.removeEventListener(MARKETPLACE_ALERT_SETTINGS_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!memberId) return;
    const registerToken = async (payload: AndroidPushTokenBridgePayload) => {
      if (!/^(?:ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(payload.token)) return;
      try {
        await fetch("/api/mobile/push-token", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: payload.token, enabled: payload.enabled !== false }),
        });
      } catch {
        // The app retries on the next page load or setting change without blocking marketplace use.
      }
    };
    const onAndroidPushToken = (event: Event) => {
      const payload = (event as CustomEvent<AndroidPushTokenBridgePayload>).detail;
      if (payload) void registerToken(payload);
    };
    if (window.abyssAndroidPushToken) void registerToken(window.abyssAndroidPushToken);
    window.addEventListener("abyss:native-push-token", onAndroidPushToken);
    return () => window.removeEventListener("abyss:native-push-token", onAndroidPushToken);
  }, [memberId]);

  const presentAlert = useCallback((payload: MarketplaceRequestAlert, force = false) => {
    if (!force && !settings.enabled) return;
    setAlert(payload);
    if (window.abyssDesktop?.showNotification) window.abyssDesktop.showNotification({ title: payload.title, body: payload.body, volume: settings.volume });
    else playChime(settings.volume);
    if (window.ReactNativeWebView?.postMessage) window.ReactNativeWebView.postMessage(JSON.stringify({ type: "marketplace-request", pendingCount: 1, alert: payload }));
    if (settings.browserNotifications && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(payload.title, { body: payload.body, tag: payload.id });
  }, [settings]);

  useEffect(() => {
    if (!memberId) return;
    const source = new EventSource("/api/marketplace/events");
    const onRequest = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as MarketplaceRequestAlert;
        if (!payload?.id || payload.recipientMemberId !== memberId || seenAlertIds.current.has(payload.id)) return;
        seenAlertIds.current.add(payload.id);
        if (seenAlertIds.current.size > 100) seenAlertIds.current.clear();
        presentAlert(payload);
      } catch {
        // Ignore malformed event data and keep the live marketplace connection running.
      }
    };
    source.addEventListener("marketplace-request", onRequest as EventListener);
    return () => source.close();
  }, [memberId, presentAlert]);

  useEffect(() => {
    const onTestAlert = (event: Event) => {
      const payload = (event as CustomEvent<MarketplaceRequestAlert>).detail;
      if (!payload?.id || payload.recipientMemberId !== memberId) return;
      presentAlert(payload, true);
    };
    window.addEventListener(MARKETPLACE_ALERT_TEST_EVENT, onTestAlert);
    return () => window.removeEventListener(MARKETPLACE_ALERT_TEST_EVENT, onTestAlert);
  }, [memberId, presentAlert]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 20_000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;
  return (
    <section data-testid="marketplace-request-alert-card" role="alertdialog" aria-label="새 거래 요청 알림" className="fixed right-4 top-4 z-[90] w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-100/60 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-4 text-white shadow-2xl shadow-slate-950/60">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400" />
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex rounded-xl bg-cyan-300/15 p-2 text-cyan-100"><BellRing className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black tracking-[0.16em] text-cyan-200">ABYSS 거래 요청</p><h2 className="mt-1 truncate text-base font-black">{alert.title}</h2><p className="mt-1 text-sm leading-5 text-slate-200">{alert.body}</p></div>
        <button type="button" aria-label="거래 요청 알림 닫기" onClick={() => setAlert(null)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={() => { setAlert(null); setLocation("/marketplace?tab=inbox"); }} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-200 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-white active:scale-[0.98]">요청함 열기 <ChevronRight className="h-4 w-4" /></button>
    </section>
  );
}
