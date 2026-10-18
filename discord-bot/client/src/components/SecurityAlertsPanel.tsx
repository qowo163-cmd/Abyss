import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SECURITY_EVENT_LABELS,
  acknowledgeSecurityEvent,
  fetchSecurityEvents,
  subscribeToSecurityEvents,
  type SecurityEventItem,
} from "@/lib/securityEvents";

type EventFilter = "all" | "unread" | "acknowledged";

function eventBadgeClass(eventType: SecurityEventItem["eventType"]) {
  if (eventType === "print_screen_key" || eventType === "print_requested") return "border-red-400/30 bg-red-500/15 text-red-200";
  if (eventType === "developer_tools_shortcut" || eventType === "copy_shortcut" || eventType === "save_shortcut") return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  return "border-cyan-400/25 bg-cyan-500/15 text-cyan-100";
}

function updateEvents(current: SecurityEventItem[], event: SecurityEventItem) {
  return [event, ...current.filter((candidate) => candidate.id !== event.id)]
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export default function SecurityAlertsPanel() {
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [filter, setFilter] = useState<EventFilter>("unread");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRequestingNotification, setIsRequestingNotification] = useState(false);

  const refresh = async (showToast = false) => {
    setIsRefreshing(true);
    try {
      setEvents(await fetchSecurityEvents());
      if (showToast) toast.success("보안 알림 목록을 새로고침했습니다.");
    } catch {
      toast.error("보안 알림 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    return subscribeToSecurityEvents((event) => {
      setEvents((current) => updateEvents(current, event));
      if (event.acknowledgedAt) return;
      const label = SECURITY_EVENT_LABELS[event.eventType];
      toast.warning(`새 보안 이벤트: ${event.memberNickname || event.memberUsername} · ${label}`);
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        new Notification("ABYSS 보안 알림", { body: `${event.memberNickname || event.memberUsername} · ${label}` });
      }
    }, setEvents);
  }, []);

  const unreadCount = events.filter((event) => !event.acknowledgedAt).length;
  const visibleEvents = useMemo(() => events.filter((event) => {
    if (filter === "unread") return !event.acknowledgedAt;
    if (filter === "acknowledged") return Boolean(event.acknowledgedAt);
    return true;
  }), [events, filter]);

  const handleAcknowledge = async (id: string) => {
    try {
      const acknowledged = await acknowledgeSecurityEvent(id);
      setEvents((current) => updateEvents(current, acknowledged));
      toast.success("보안 이벤트를 확인 처리했습니다.");
    } catch {
      toast.error("보안 이벤트를 확인 처리하지 못했습니다.");
    }
  };

  const requestBrowserNotification = async () => {
    if (typeof Notification === "undefined") {
      toast.error("이 브라우저는 시스템 알림을 지원하지 않습니다.");
      return;
    }
    setIsRequestingNotification(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") toast.success("브라우저 보안 알림을 허용했습니다.");
      else toast.error("브라우저 알림 권한이 허용되지 않았습니다.");
    } finally {
      setIsRequestingNotification(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-300" />
            <div>
              <h2 className="font-bold text-red-100">보안 알림</h2>
              <p className="mt-1 text-sm leading-6 text-red-100/80">웹에서 감지 가능한 보호 우회·이탈 이벤트를 로그인 회원과 함께 기록합니다. Windows 전체 화면 캡처는 웹사이트에서 감지할 수 없습니다.</p>
            </div>
          </div>
          <span data-testid="security-unread-count" className="inline-flex shrink-0 items-center rounded-full border border-cyan-950 bg-cyan-800 px-3 py-1 text-sm font-bold text-cyan-50 shadow-md shadow-cyan-950/35">미확인 {unreadCount}건</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {([
            ["unread", `미확인 ${unreadCount}`],
            ["all", `전체 ${events.length}`],
            ["acknowledged", "확인 완료"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${filter === value ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-50" : "border-slate-700 bg-slate-900/70 text-slate-300"}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void requestBrowserNotification()} disabled={isRequestingNotification} className="gap-1.5 border-amber-400/25 text-amber-100">
            <BellRing aria-hidden="true" className="size-4" />알림 허용
          </Button>
          <Button size="sm" variant="outline" onClick={() => void refresh(true)} disabled={isRefreshing} className="gap-1.5 border-cyan-400/25 text-cyan-100">
            <RefreshCw aria-hidden="true" className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />새로고침
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-8 text-center text-sm text-cyan-200">보안 알림을 불러오는 중입니다...</div>
      ) : visibleEvents.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-8 text-center text-sm text-slate-400">표시할 보안 이벤트가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {visibleEvents.map((event) => (
            <article key={event.id} className={`rounded-lg border p-4 ${event.acknowledgedAt ? "border-slate-700 bg-slate-900/55" : "border-red-400/25 bg-slate-900/80 shadow-lg shadow-red-950/10"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${eventBadgeClass(event.eventType)}`}>{SECURITY_EVENT_LABELS[event.eventType]}</span>
                    {!event.acknowledgedAt && <span className="rounded-md border border-red-400/25 bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-100">미확인</span>}
                    {event.acknowledgedAt && <span className="rounded-md border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-100">확인 완료</span>}
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-100">{event.memberNickname || event.memberUsername} <span className="font-normal text-slate-400">({event.memberUsername})</span></h3>
                  <p className="mt-1 break-all text-xs text-slate-400">경로: {event.path}</p>
                  <p className="mt-1 text-xs text-slate-500">발생: {new Date(event.createdAt).toLocaleString("ko-KR")}</p>
                </div>
                {!event.acknowledgedAt && <Button size="sm" variant="outline" onClick={() => void handleAcknowledge(event.id)} className="min-h-10 shrink-0 gap-1.5 border-emerald-400/25 text-emerald-100"><Check aria-hidden="true" className="size-4" />확인 처리</Button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
