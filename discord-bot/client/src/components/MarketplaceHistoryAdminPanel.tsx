import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGpAmount } from "@/lib/formatGp";
import { deleteAdminMarketplaceHistoryRecord, getAdminMarketplaceHistory, type MarketplaceHistoryCategory, type MarketplaceHistoryEntry, type MarketplaceHistoryFilters, type MarketplaceHistoryStatus, type MarketplaceHistoryType } from "@/lib/marketplace";

const categoryLabel = { all: "전체", hench: "헨치", item: "아이템" } as const;
const typeLabel = { all: "전체 방식", sell: "판매", buy: "구매", exchange: "교환" } as const;
const statusLabel = { all: "전체 상태", active: "판매중", reserved: "거래 예약", completed: "완료", cancelled: "취소", pending: "제안 대기", accepted: "제안 수락", rejected: "제안 거절" } as const;
const HISTORY_PAGE_SIZE = 50;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

function currencyLabel(record: MarketplaceHistoryEntry) {
  if (record.priceCurrency === "exchange") return "헨치 교환";
  if (record.priceAmount === null) return "가격 미입력";
  return record.priceCurrency === "gp" ? formatGpAmount(record.priceAmount) : `${new Intl.NumberFormat("ko-KR").format(record.priceAmount)} 자사`;
}

function statusClass(status: MarketplaceHistoryEntry["status"]) {
  return status === "completed" ? "bg-emerald-400/15 text-emerald-200" : status === "reserved" || status === "accepted" ? "bg-sky-400/15 text-sky-200" : status === "cancelled" || status === "rejected" ? "border border-rose-600 bg-rose-200 text-rose-900" : "bg-amber-400/15 text-amber-200";
}

export default function MarketplaceHistoryAdminPanel() {
  const [filters, setFilters] = useState<Required<Pick<MarketplaceHistoryFilters, "category" | "listingType" | "status" | "days">> & Pick<MarketplaceHistoryFilters, "query">>({ category: "all", listingType: "all", status: "all", days: "all", query: "" });
  const [records, setRecords] = useState<MarketplaceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(filters.query ?? "", 250);
  const requestFilters = useMemo(() => ({
    category: filters.category,
    listingType: filters.listingType,
    status: filters.status,
    days: filters.days,
    query: debouncedQuery.trim(),
    limit: 200,
  }), [debouncedQuery, filters.category, filters.days, filters.listingType, filters.status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminMarketplaceHistory(requestFilters);
      setRecords(result.records || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "거래 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [requestFilters]);

  useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
    void load();
  }, [load]);

  const updateFilter = <K extends keyof typeof filters>(key: K, value: typeof filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const visibleRecords = useMemo(() => records.slice(0, visibleCount), [records, visibleCount]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = useCallback(async (record: MarketplaceHistoryEntry) => {
    const ok = window.confirm(`이 거래 기록을 정말 삭제할까요?\n"${record.subjectName}" (${record.ownerNickname})\n\n삭제하면 되돌릴 수 없습니다.`);
    if (!ok) return;
    setDeletingId(record.id);
    try {
      await deleteAdminMarketplaceHistoryRecord(record);
      setRecords((current) => current.filter((item) => item.id !== record.id));
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "거래 기록을 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  return <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-xl font-bold text-cyan-300"><History className="h-5 w-5" />거래 기록</h2><p className="mt-1 text-sm text-slate-400">헨치·아이템 등록글의 현재 상태와 거래 상대, 가격, 처리 이력을 관리자만 확인할 수 있습니다.</p></div>
      <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="border-slate-600 text-slate-200"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />새로고침</Button>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label className="space-y-1 text-xs font-medium text-slate-400">구분<select value={filters.category} onChange={(event) => updateFilter("category", event.target.value as MarketplaceHistoryCategory)} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"><option value="all">전체</option><option value="hench">헨치</option><option value="item">아이템</option></select></label>
      <label className="space-y-1 text-xs font-medium text-slate-400">방식<select value={filters.listingType} onChange={(event) => updateFilter("listingType", event.target.value as MarketplaceHistoryType)} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"><option value="all">전체 방식</option><option value="sell">판매</option><option value="buy">구매</option><option value="exchange">교환</option></select></label>
      <label className="space-y-1 text-xs font-medium text-slate-400">상태<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as MarketplaceHistoryStatus)} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"><option value="all">전체 상태</option><option value="active">판매중</option><option value="reserved">거래 예약</option><option value="pending">제안 대기</option><option value="accepted">제안 수락</option><option value="rejected">제안 거절</option><option value="completed">완료</option><option value="cancelled">취소</option></select></label>
      <label className="space-y-1 text-xs font-medium text-slate-400">기간<select value={filters.days} onChange={(event) => updateFilter("days", event.target.value as "all" | "7" | "30" | "90")} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"><option value="all">전체 기간</option><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option></select></label>
      <label className="space-y-1 text-xs font-medium text-slate-400">검색<div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><Input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="대상·닉네임" className="h-9 border-slate-700 bg-slate-950 pl-8 text-sm text-slate-100" /></div></label>
    </div>
    <div className="flex items-center justify-between border-y border-slate-700/70 py-3 text-sm"><span className="text-slate-400">조건에 맞는 기록</span><span className="font-semibold text-cyan-200">{records.length.toLocaleString("ko-KR")}건</span></div>
    {loading ? <div className="flex min-h-44 items-center justify-center text-cyan-200"><Loader2 className="mr-2 h-5 w-5 animate-spin" />거래 기록을 불러오는 중입니다.</div> : error ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : records.length === 0 ? <div className="rounded-lg border border-dashed border-slate-700 py-12 text-center text-sm text-slate-400">현재 조건의 거래 기록이 없습니다.</div> : <div className="space-y-3" data-testid="marketplace-history-record-list">{visibleRecords.map((record) => <article data-testid="marketplace-history-record" key={record.id} className="rounded-xl border border-slate-700 bg-slate-950/45 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-cyan-400/10 px-2 py-0.5 text-xs font-semibold text-cyan-200">{record.recordKind === "listing" ? "등록글" : "거래 제안"} · {categoryLabel[record.category]} · {typeLabel[record.listingType]}</span><span data-testid={`marketplace-history-status-${record.status}`} className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClass(record.status)}`}>{statusLabel[record.status]}</span><span className="text-xs text-slate-500">{new Date(record.updatedAt).toLocaleString("ko-KR")}</span></div><h3 className="mt-2 text-base font-semibold text-slate-100">{record.subjectName} <span className="text-sm font-normal text-slate-400">{record.quantity.toLocaleString("ko-KR")}개 · {currencyLabel(record)}</span></h3><p className="mt-1 text-sm text-slate-400">{record.recordKind === "listing" ? "등록" : "제안"}: <span className="text-slate-200">{record.ownerNickname} ({record.ownerGameNickname})</span>{record.counterpartNickname ? <> <span className="mx-1 text-slate-600">→</span> 상대: <span className="text-slate-200">{record.counterpartNickname} ({record.counterpartGameNickname || "-"})</span></> : ""}</p>{record.note && <p className="mt-2 text-sm text-slate-500">메모: {record.note}</p>}</div><Button type="button" size="sm" variant="outline" onClick={() => void handleDelete(record)} disabled={deletingId === record.id} className="border-rose-700 text-rose-300 hover:bg-rose-950 hover:text-rose-200 lg:shrink-0">{deletingId === record.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}삭제</Button></div></article>)}{visibleRecords.length < records.length && <Button type="button" variant="outline" className="w-full" onClick={() => setVisibleCount((current) => current + HISTORY_PAGE_SIZE)}>거래 기록 더 보기 ({visibleRecords.length}/{records.length})</Button>}</div>}
  </section>;
}
