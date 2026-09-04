import { UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 30_000;

function validCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function OnlineMemberCount() {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/online-count", { cache: "no-cache" });
      const payload = await response.json();
      if (!response.ok) throw new Error("온라인 인원을 불러오지 못했습니다.");
      setCount(validCount(payload?.count));
    } catch {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="online-member-count mb-3 flex items-center justify-between rounded-xl border border-emerald-500/70 bg-emerald-100/85 px-3 py-2.5 shadow-sm shadow-emerald-400/20" title="최근 90초 안에 활동한 승인 회원 수">
      <span className="flex items-center gap-2 text-xs font-bold text-emerald-900">
        <UsersRound className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        현재 접속
      </span>
      <strong className="text-sm font-extrabold text-emerald-800" aria-live="polite">
        {count === null ? "확인 중" : `${count}명`}
      </strong>
    </div>
  );
}
