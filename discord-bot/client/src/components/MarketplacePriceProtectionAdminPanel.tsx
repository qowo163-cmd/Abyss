import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type PriceLine = { id: string; targetType: "hench" | "item"; title: string; description: string; initialBoxesPerUnit: number | null };
type PriceAlert = { id: string; targetType: "hench" | "item"; targetName: string; baselineBoxesPerUnit: number; recentAverageBoxesPerUnit: number; declinePercent: number; source: string; createdAt: string; acknowledgedAt: string | null };

const formatNumber = (value: number) => value.toLocaleString("ko-KR");

export default function MarketplacePriceProtectionAdminPanel() {
  const [lines, setLines] = useState<PriceLine[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const openAlerts = useMemo(() => alerts.filter((alert) => !alert.acknowledgedAt), [alerts]);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/marketplace/price-protection", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "시세 보호 정보를 불러오지 못했습니다.");
    setLines(data.lines || []);
    setAlerts(data.alerts || []);
  }, []);

  useEffect(() => { void load().catch((error) => toast.error(error instanceof Error ? error.message : "시세 보호 정보를 불러오지 못했습니다.")); }, [load]);

  const resetLine = async (line: PriceLine) => {
    if (!window.confirm(`‘${line.title}’ 시세 라인을 최초 시세표 기준으로 복원할까요?`)) return;
    setBusy(`reset-${line.id}`);
    try {
      const response = await fetch("/api/admin/marketplace/price-protection/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineId: line.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "시세 라인을 복원하지 못했습니다.");
      toast.success(`${line.title} 초기 시세표를 복원했습니다. (${formatNumber(data.result?.affectedRows || 0)}건)`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "시세 라인 복원에 실패했습니다."); }
    finally { setBusy(null); }
  };

  const acknowledge = async (alert: PriceAlert) => {
    setBusy(`alert-${alert.id}`);
    try {
      const response = await fetch(`/api/admin/marketplace/price-alerts/${alert.id}/acknowledge`, { method: "PATCH" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "시세 알림을 확인 처리하지 못했습니다.");
      toast.success("시세 급락 알림을 확인 처리했습니다.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "시세 알림 처리에 실패했습니다."); }
    finally { setBusy(null); }
  };

  return <section className="space-y-5 rounded-xl border-2 border-amber-500/50 bg-slate-950 p-5 shadow-xl shadow-amber-950/20">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-amber-300"><ShieldAlert className="h-4 w-4" /> 거래소 시세 보호</p><h2 className="mt-1 text-xl font-black text-white">저가 등록 차단 · 급락 알림 · 초기 시세표 복원</h2><p className="mt-1 text-sm text-slate-300">평균 거래가의 50% 미만 등록은 서버에서 차단됩니다. 최근 평균가가 초기 기준가보다 30% 이상 하락하면 아래에 알림이 쌓입니다.</p></div><span className="rounded-full border-2 border-amber-950 bg-amber-400 px-3 py-1 text-sm font-black text-slate-950">미확인 {openAlerts.length}건</span></div>
    <div className="rounded-xl border border-rose-500/50 bg-rose-950/50 p-4"><div className="flex items-center gap-2 font-black text-rose-100"><AlertTriangle className="h-5 w-5 text-rose-300" /> 시세 30% 이상 하락 알림</div><div className="mt-3 space-y-2">{openAlerts.length === 0 ? <p className="rounded-lg border border-dashed border-rose-700 bg-slate-950 px-3 py-4 text-sm font-semibold text-slate-400">현재 미확인 시세 급락 알림이 없습니다.</p> : openAlerts.map((alert) => <article key={alert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-600 bg-slate-900 p-3"><div><p className="font-black text-white">{alert.targetType === "item" ? "아이템" : "헨치"} · {alert.targetName}</p><p className="mt-1 text-sm text-rose-200">초기 {formatNumber(alert.baselineBoxesPerUnit)} → 최근 {formatNumber(alert.recentAverageBoxesPerUnit)} · {formatNumber(alert.declinePercent)}% 하락</p></div><Button type="button" disabled={busy === `alert-${alert.id}`} onClick={() => void acknowledge(alert)} className="border-2 border-emerald-950 bg-emerald-600 font-black text-white hover:bg-emerald-700"><Check className="mr-1 h-4 w-4" />확인</Button></article>)}</div></div>
    <div><h3 className="text-base font-black text-cyan-200">시세 라인별 최초 시세표 복원</h3><p className="mt-1 text-sm text-slate-400">해당 라인만 최초 등록 시점의 기준가로 되돌립니다. 최근 완료 거래 기록은 삭제하지 않습니다.</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lines.map((line) => <article key={line.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="font-black text-white">{line.title}</p><p className="mt-1 min-h-10 text-sm text-slate-400">{line.description}</p><p className="mt-2 text-sm font-bold text-cyan-200">{line.initialBoxesPerUnit === null ? "초기 기준가 없음" : `초기 마리당 자사 ${formatNumber(line.initialBoxesPerUnit)}개`}</p><Button type="button" variant="outline" disabled={busy === `reset-${line.id}`} onClick={() => void resetLine(line)} className="mt-3 border-amber-400 bg-amber-500 font-extrabold text-slate-950 shadow-md shadow-amber-950/40 hover:bg-amber-400 hover:text-slate-950"><RefreshCcw className="mr-1 h-4 w-4" />이 라인 초기화</Button></article>)}</div></div>
  </section>;
}
