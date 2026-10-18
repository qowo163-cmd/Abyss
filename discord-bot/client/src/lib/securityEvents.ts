export const SECURITY_EVENT_LABELS = {
  focus_lost: "창 포커스 이탈",
  tab_hidden: "탭·화면 전환",
  print_requested: "인쇄 시도",
  copy_shortcut: "복사 단축키 시도",
  save_shortcut: "저장 단축키 시도",
  developer_tools_shortcut: "개발자 도구 단축키 시도",
  print_screen_key: "Print Screen 키 감지",
  context_menu: "우클릭 시도",
  drag_attempt: "드래그 시도",
} as const;

export type SecurityEventType = keyof typeof SECURITY_EVENT_LABELS;

export interface SecurityEventItem {
  id: string;
  memberId: string;
  memberUsername: string;
  memberNickname: string;
  eventType: SecurityEventType;
  path: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

function normalizeSecurityEvent(value: unknown): SecurityEventItem | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<SecurityEventItem>;
  if (!event.id || !event.memberId || !event.memberUsername || !event.eventType || !event.path || !event.createdAt) return null;
  if (!(event.eventType in SECURITY_EVENT_LABELS)) return null;
  return {
    id: String(event.id),
    memberId: String(event.memberId),
    memberUsername: String(event.memberUsername),
    memberNickname: String(event.memberNickname || ""),
    eventType: event.eventType,
    path: String(event.path),
    createdAt: String(event.createdAt),
    acknowledgedAt: event.acknowledgedAt ? String(event.acknowledgedAt) : null,
    acknowledgedBy: event.acknowledgedBy ? String(event.acknowledgedBy) : null,
  };
}

export function normalizeSecurityEvents(values: unknown): SecurityEventItem[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const event = normalizeSecurityEvent(value);
    return event ? [event] : [];
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function reportSecurityEvent(eventType: SecurityEventType, path = window.location.pathname) {
  return fetch("/api/security-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, path }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

export async function fetchSecurityEvents(): Promise<SecurityEventItem[]> {
  const response = await fetch("/api/security-events", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  return normalizeSecurityEvents(await response.json());
}

export async function acknowledgeSecurityEvent(id: string): Promise<SecurityEventItem> {
  const response = await fetch(`/api/security-events/${encodeURIComponent(id)}/acknowledge`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  const payload = await response.json() as { event?: unknown };
  const event = normalizeSecurityEvent(payload.event);
  if (!event) throw new Error("Malformed security event response");
  return event;
}

export function subscribeToSecurityEvents(onEvent: (event: SecurityEventItem) => void, onInitial?: (events: SecurityEventItem[]) => void) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return () => undefined;
  const source = new EventSource("/api/security-events/events");
  source.addEventListener("security-events", (rawEvent) => {
    try {
      onInitial?.(normalizeSecurityEvents(JSON.parse((rawEvent as MessageEvent<string>).data)));
    } catch {
      // 목록을 유지하고 다음 실시간 이벤트를 기다립니다.
    }
  });
  source.addEventListener("security-event", (rawEvent) => {
    try {
      const event = normalizeSecurityEvent(JSON.parse((rawEvent as MessageEvent<string>).data));
      if (event) onEvent(event);
    } catch {
      // 잘못된 실시간 이벤트는 무시합니다.
    }
  });
  return () => source.close();
}
