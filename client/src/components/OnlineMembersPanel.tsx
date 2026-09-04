import { Activity, Loader2, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type OnlineMember = { id: string; username: string; nickname: string; gameNickname: string; role: "member" | "admin"; lastActivityAt: string | null };

export default function OnlineMembersPanel() {
  const [members, setMembers] = useState<OnlineMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/members/active", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "접속자 목록을 불러오지 못했습니다.");
      setMembers(Array.isArray(payload?.members) ? payload.members : []);
      setUpdatedAt(new Date()); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "접속자 목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15_000); return () => window.clearInterval(timer); }, [refresh]);
  return <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-300" /><h2 className="text-xl font-bold text-cyan-300">실시간 접속자</h2></div><p className="mt-1 text-sm text-slate-400">최근 90초 안에 활동한 승인 회원입니다. 15초마다 자동으로 새로 고칩니다.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void refresh()} className="border-slate-600 text-slate-200"><RefreshCw className="mr-1 h-3.5 w-3.5" />새로고침</Button></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="text-xs font-semibold text-emerald-200/70">현재 접속 중</p><p className="mt-1 text-3xl font-bold text-emerald-200">{members.length}<span className="ml-1 text-base font-medium">명</span></p>{updatedAt && <p className="mt-1 text-xs text-slate-500">마지막 확인: {updatedAt.toLocaleTimeString("ko-KR")}</p>}</div>{loading ? <div className="flex min-h-36 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />접속자 확인 중</div> : error ? <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : members.length === 0 ? <p className="rounded-lg border border-dashed border-slate-600 p-8 text-center text-sm text-slate-400">현재 활동 중인 회원이 없습니다.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{members.map((member) => <article key={member.id} className="rounded-xl border border-slate-600 bg-slate-950/85 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-bold text-cyan-200">{member.gameNickname}</p><p className="mt-1 text-sm font-semibold text-slate-100">{member.nickname} <span className="text-slate-400">({member.username})</span></p></div>{member.role === "admin" && <span className="rounded-full bg-violet-400/15 px-2 py-1 text-xs font-semibold text-violet-200">관리자</span>}</div><p className="mt-3 text-xs text-slate-400">최근 활동: {member.lastActivityAt ? new Date(member.lastActivityAt).toLocaleString("ko-KR") : "확인 중"}</p></article>)}</div>}</section>;
}
