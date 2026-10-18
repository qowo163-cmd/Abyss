import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Clock3, Globe2, KeyRound, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserRoundX, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMembership, type MemberStatus } from "@/contexts/MembershipContext";

interface ManagedMember {
  id: string;
  username: string;
  nickname: string;
  discordNickname: string;
  gameNickname: string;
  role: "member" | "admin";
  status: MemberStatus;
  approvedAt?: string | null;
  lastActivityAt?: string | null;
  lastIpAddress?: string | null;
  createdAt: string;
}

interface MemberIpAccessLog {
  id: string;
  memberId: string;
  ipAddress: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

type StatusFilter = "all" | MemberStatus;

const statusPresentation: Record<MemberStatus, { label: string; badge: string }> = {
  pending: { label: "승인 대기", badge: "bg-amber-500/15 text-amber-200 border-amber-400/30" },
  approved: { label: "승인됨", badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" },
  suspended: { label: "이용 정지", badge: "bg-red-500/15 text-red-200 border-red-400/30" },
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("ko-KR");
}

export default function MemberManagement({ embedded = false }: { embedded?: boolean }) {
  const { member: currentMember } = useMembership();
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [activeMembers, setActiveMembers] = useState<ManagedMember[]>([]);
  const [memberToDelete, setMemberToDelete] = useState<ManagedMember | null>(null);
  const [memberToResetPassword, setMemberToResetPassword] = useState<ManagedMember | null>(null);
  const [ipLogsByMember, setIpLogsByMember] = useState<Record<string, MemberIpAccessLog[] | undefined>>({});

  const loadMembers = useCallback(async (showSuccess = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/members", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "회원 목록을 불러오지 못했습니다.");
      setMembers(Array.isArray(payload) ? payload : []);
      if (showSuccess) toast.success("회원 목록을 새로고침했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActiveMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/members/active", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "활동 회원 정보를 불러오지 못했습니다.");
      setActiveMembers(Array.isArray(payload?.members) ? payload.members : []);
    } catch (error) {
      console.error("Failed to load active members:", error);
    }
  }, []);

  const refreshMemberData = useCallback(async (showSuccess = false) => {
    await Promise.all([loadMembers(showSuccess), loadActiveMembers()]);
  }, [loadActiveMembers, loadMembers]);

  const loadIpHistory = useCallback(async (memberId: string) => {
    try {
      const response = await fetch(`/api/auth/members/${memberId}/ip-history`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "접속 IP 이력을 불러오지 못했습니다.");
      setIpLogsByMember((current) => ({ ...current, [memberId]: Array.isArray(payload?.logs) ? payload.logs : [] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "접속 IP 이력을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (currentMember?.role !== "admin") return;
    void refreshMemberData();
    const intervalId = window.setInterval(() => void refreshMemberData(), 15_000);
    return () => window.clearInterval(intervalId);
  }, [currentMember?.role, refreshMemberData]);

  const counts = useMemo(() => ({
    all: members.length,
    pending: members.filter((member) => member.status === "pending").length,
    approved: members.filter((member) => member.status === "approved").length,
    suspended: members.filter((member) => member.status === "suspended").length,
  }), [members]);

  const activeMemberIds = useMemo(() => new Set(activeMembers.map((member) => member.id)), [activeMembers]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return members.filter((member) => {
      const matchesStatus = statusFilter === "all" || member.status === statusFilter;
      const matchesQuery = !query || [member.username, member.nickname, member.discordNickname, member.gameNickname]
        .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [members, searchQuery, statusFilter]);

  const updateStatus = async (memberId: string, status: MemberStatus) => {
    setUpdatingMemberId(memberId);
    try {
      const response = await fetch(`/api/auth/members/${memberId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "회원 상태 변경에 실패했습니다.");
      setMembers((current) => current.map((member) => member.id === memberId ? payload.member : member));
      toast.success(status === "approved" ? "회원 승인이 완료되었습니다." : status === "pending" ? "승인 대기 상태로 변경했습니다." : "회원 이용을 정지했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "회원 상태 변경에 실패했습니다.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const deleteMemberAccount = async () => {
    if (!memberToDelete) return;
    setUpdatingMemberId(memberToDelete.id);
    try {
      const response = await fetch(`/api/auth/members/${memberToDelete.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "회원 탈퇴 처리에 실패했습니다.");
      setMembers((current) => current.filter((member) => member.id !== memberToDelete.id));
      setActiveMembers((current) => current.filter((member) => member.id !== memberToDelete.id));
      toast.success(`${memberToDelete.username} 계정을 탈퇴 처리했습니다.`);
      setMemberToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "회원 탈퇴 처리에 실패했습니다.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const resetMemberPassword = async () => {
    if (!memberToResetPassword) return;
    setUpdatingMemberId(memberToResetPassword.id);
    try {
      const response = await fetch(`/api/auth/members/${memberToResetPassword.id}/password/reset`, { method: "PATCH" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "비밀번호 초기화에 실패했습니다.");
      toast.success(`${memberToResetPassword.username} 계정 비밀번호를 1234로 초기화했습니다.`);
      setMemberToResetPassword(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "비밀번호 초기화에 실패했습니다.");
    } finally { setUpdatingMemberId(null); }
  };

  if (currentMember?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-5">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-7 text-center shadow-2xl">
          <ShieldCheck className="mx-auto h-10 w-10 text-cyan-300" />
          <h1 className="mt-4 text-xl font-bold text-cyan-200">관리자 권한 필요</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">회원 관리 페이지는 관리자만 이용할 수 있습니다.</p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-100"><ArrowLeft className="h-4 w-4" /> 홈으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const statCards = [
    { id: "all" as const, label: "전체 회원", count: counts.all, icon: UsersRound, color: "text-cyan-300" },
    { id: "pending" as const, label: "승인 대기", count: counts.pending, icon: Clock3, color: "text-amber-300" },
    { id: "approved" as const, label: "승인 회원", count: counts.approved, icon: UserCheck, color: "text-emerald-300" },
    { id: "suspended" as const, label: "이용 정지", count: counts.suspended, icon: UserRoundX, color: "text-red-300" },
  ];

  return (
    <div data-testid="member-management-panel" className={embedded ? "space-y-5" : "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-28 md:pb-8"}>
      {!embedded && <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-cyan-300"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-bold tracking-[0.18em]">ADMIN CONSOLE</span></div>
            <h1 className="mt-1 text-xl font-bold text-slate-100 sm:text-2xl">회원 관리</h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">가입 요청, 계정 상태, 회원 정보를 한곳에서 관리합니다.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refreshMemberData(true)} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">새로고침</span>
            </Button>
            <Link href="/admin" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-200"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">관리자</span></Link>
          </div>
        </div>
      </header>}

      <main className={embedded ? "space-y-5" : "mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6"}>
        {embedded && <section className="flex flex-col gap-3 rounded-xl border border-cyan-400/25 bg-slate-900/65 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-cyan-300"><UsersRound className="h-5 w-5" /><span className="text-xs font-bold tracking-[0.18em]">ADMIN CONSOLE</span></div>
            <h2 className="mt-1 text-xl font-bold text-slate-100 sm:text-2xl">회원 관리</h2>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">가입 요청, 계정 상태, 접속 정보와 IP 이력을 한곳에서 관리합니다.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshMemberData(true)} disabled={loading} className="shrink-0 gap-2 border-slate-700 text-slate-200">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />새로고침
          </Button>
        </section>}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map(({ id, label, count, icon: Icon, color }) => (
            <button key={id} type="button" onClick={() => setStatusFilter(id)} className={`rounded-xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${statusFilter === id ? "border-cyan-400/70 bg-cyan-500/10 shadow-lg shadow-cyan-900/20" : "border-slate-700 bg-slate-900/60 hover:border-slate-500"}`}>
              <Icon className={`h-5 w-5 ${color}`} />
              <p className="mt-4 text-2xl font-bold text-slate-100">{count}</p>
              <p className="mt-1 text-xs text-slate-400">{label}</p>
            </button>
          ))}
        </section>

        <section data-testid="active-members-panel" className="abyss-active-members-panel rounded-xl border p-4 shadow-xl" aria-live="polite">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span data-testid="active-members-radar" role="img" aria-label="접속 감지 레이더 작동 중" className="abyss-online-radar relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"><span aria-hidden="true" className="abyss-online-radar-dot relative h-2.5 w-2.5 rounded-full" /></span>
              <div><p className="abyss-active-members-heading font-bold">현재 접속 중인 이용자 <span className="text-xl">{activeMembers.length}</span>명</p><p className="abyss-active-members-help mt-0.5 text-xs">활동 신호 기준으로 15초마다 자동 갱신됩니다.</p></div>
            </div>
            <span className="abyss-active-members-live w-fit rounded-full border px-3 py-1 text-xs font-bold">실시간 갱신</span>
          </div>
          <div className="mt-4 border-t border-emerald-200/30 pt-3">
            <p className="abyss-active-members-list-label text-xs font-extrabold tracking-wide">접속 중인 회원</p>
            {activeMembers.length === 0 ? <p className="mt-2 text-sm text-slate-200">현재 활동 중인 회원이 없습니다.</p> : <div data-testid="active-members-list" className="mt-2 flex flex-wrap gap-2">{activeMembers.map((member) => <span key={member.id} className="abyss-active-member-chip max-w-full rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm">{member.nickname} <span className="abyss-active-member-chip-id">({member.username})</span></span>)}</div>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 shadow-xl shadow-slate-950/20 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="아이디, 닉네임, 디스코드, 인게임 닉네임 검색" className="border-slate-700 bg-slate-950/70 pl-10" />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="회원 상태 필터">
              {(["all", "pending", "approved", "suspended"] as StatusFilter[]).map((status) => (
                <Button key={status} size="sm" variant={statusFilter === status ? "default" : "outline"} onClick={() => setStatusFilter(status)} className={statusFilter === status ? "bg-cyan-600 hover:bg-cyan-500" : "border-slate-700 text-slate-300"}>
                  {status === "all" ? "전체" : statusPresentation[status].label}
                </Button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-400"><span className="font-semibold text-cyan-200">{filteredMembers.length}</span>명의 회원이 조건에 맞습니다.</p>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60 shadow-xl shadow-slate-950/20">
          <div className="hidden grid-cols-[1.1fr_1.4fr_1.6fr_0.75fr_1fr] gap-4 border-b border-slate-700 bg-slate-800/70 px-5 py-3 text-xs font-semibold text-slate-400 lg:grid">
            <span>계정</span><span>가입 정보</span><span>가입일 / 승인일 / 마지막 접속 / IP</span><span>상태</span><span className="text-right">관리</span>
          </div>
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">회원 목록을 불러오는 중입니다...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">조건에 맞는 회원이 없습니다.</div>
          ) : filteredMembers.map((member) => {
            const presentation = statusPresentation[member.status];
            const isUpdating = updatingMemberId === member.id;
            return (
              <article key={member.id} className="grid gap-4 border-b border-slate-800 p-4 last:border-b-0 lg:grid-cols-[1.1fr_1.4fr_1.6fr_0.75fr_1fr] lg:items-center lg:gap-4 lg:px-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-cyan-200">{member.username}</span>{activeMemberIds.has(member.id) && <span className="rounded border border-emerald-400/30 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-200">접속 중</span>}{member.role === "admin" && <span className="rounded border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-violet-200">관리자</span>}</div>
                  <p className="mt-1 text-sm text-slate-400">{member.nickname}</p>
                </div>
                <div className="grid gap-1 text-sm text-slate-300 sm:grid-cols-2 lg:block"><p><span className="text-slate-500">디스코드</span> {member.discordNickname}</p><p className="mt-0 lg:mt-1"><span className="text-slate-500">인게임</span> {member.gameNickname}</p></div>
                <div className="text-xs leading-5 text-slate-400">
                  <p><span className="text-slate-500">가입</span> {formatDate(member.createdAt)}</p><p><span className="text-slate-500">승인</span> {formatDate(member.approvedAt)}</p><p><span className="text-slate-500">마지막 접속</span> {formatDate(member.lastActivityAt)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5"><Globe2 className="h-3 w-3 text-cyan-300" aria-hidden="true" /><span className="text-slate-500">최근 IP</span><code className="rounded bg-slate-950/70 px-1.5 py-0.5 text-cyan-100">{member.lastIpAddress || "기록 없음"}</code></p>
                  <button type="button" onClick={() => void loadIpHistory(member.id)} className="mt-1 text-xs font-medium text-cyan-300 underline-offset-2 hover:text-cyan-100 hover:underline">IP 이력</button>
                  {ipLogsByMember[member.id] && <div className="mt-2 space-y-1 rounded-md border border-cyan-400/15 bg-slate-950/40 p-2 text-[11px] leading-4 text-slate-400">
                    {ipLogsByMember[member.id]!.length === 0 ? <p>저장된 IP 이력이 없습니다.</p> : ipLogsByMember[member.id]!.map((log) => <p key={log.id}><code className="text-cyan-100">{log.ipAddress}</code> <span className="text-slate-500">최근</span> {formatDate(log.lastSeenAt)}</p>)}
                  </div>}
                </div>
                <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.badge}`}>{presentation.label}</span></div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {member.role === "member" && <>
                    <Button size="sm" onClick={() => void updateStatus(member.id, "approved")} disabled={isUpdating || member.status === "approved"} className="h-8 bg-emerald-600 text-xs hover:bg-emerald-500"><Check className="mr-1 h-3.5 w-3.5" />승인</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateStatus(member.id, "pending")} disabled={isUpdating || member.status === "pending"} className="h-8 border-slate-700 text-xs text-slate-300">대기</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateStatus(member.id, "suspended")} disabled={isUpdating || member.status === "suspended"} className="abyss-danger-action h-8 text-xs">정지</Button>
                    <Button size="sm" variant="outline" onClick={() => setMemberToResetPassword(member)} disabled={isUpdating} className="h-8 border-amber-400/50 bg-amber-500/10 text-xs text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"><KeyRound className="mr-1 h-3.5 w-3.5" />비번 1234</Button>
                    <Button size="sm" variant="outline" onClick={() => setMemberToDelete(member)} disabled={isUpdating} className="abyss-danger-action h-8 text-xs"><Trash2 className="mr-1 h-3.5 w-3.5" />탈퇴</Button>
                  </>}
                  {member.role === "admin" && <span className="text-xs text-slate-500">보호된 계정</span>}
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <AlertDialog open={Boolean(memberToDelete)} onOpenChange={(open) => { if (!open) setMemberToDelete(null); }}>
        <AlertDialogContent className="border-red-500/30 bg-slate-950 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>회원 탈퇴 처리</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-slate-400"><strong className="text-red-200">{memberToDelete?.username}</strong> 계정을 탈퇴 처리하면 로그인 세션과 활동 기록이 즉시 삭제되며 복구할 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteMemberAccount()} className="abyss-danger-action">탈퇴 처리</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(memberToResetPassword)} onOpenChange={(open) => { if (!open) setMemberToResetPassword(null); }}>
        <AlertDialogContent className="border-amber-400/35 bg-slate-950 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>회원 비밀번호 초기화</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-slate-300"><strong className="text-amber-200">{memberToResetPassword?.username}</strong> 계정의 비밀번호를 <strong className="text-amber-200">1234</strong>로 초기화합니다. 해당 회원의 기존 로그인 세션은 즉시 종료됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => void resetMemberPassword()} className="bg-amber-600 text-slate-950 hover:bg-amber-500">1234로 초기화</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
