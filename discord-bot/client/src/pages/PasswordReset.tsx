import React, { useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordReset() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !currentPassword || !newPassword || !confirmPassword) { toast.error("아이디와 모든 비밀번호를 입력해 주세요."); return; }
    if (newPassword.length < 4) { toast.error("새 비밀번호는 4자 이상으로 입력해 주세요."); return; }
    if (newPassword !== confirmPassword) { toast.error("새 비밀번호 확인이 일치하지 않습니다."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim(), currentPassword, newPassword }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "비밀번호 변경에 실패했습니다.");
      toast.success("비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.");
      setLocation("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.");
    } finally { setSubmitting(false); }
  };

  return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4"><img aria-hidden="true" src="/manus-storage/abyss-login-background-no-text_2b2ef8a0.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-center" decoding="async" /><div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-slate-950/15 via-slate-950/35 to-slate-950/70" /><Card className="relative z-10 w-full max-w-md border-cyan-300/40 bg-slate-950/90 text-white shadow-2xl shadow-slate-950/70 backdrop-blur-md"><CardHeader className="space-y-2 text-center"><div className="flex justify-center"><div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 p-3"><KeyRound className="h-8 w-8 text-cyan-300" /></div></div><CardTitle className="text-2xl font-bold text-cyan-200">비밀번호 재설정</CardTitle><CardDescription className="leading-6 text-slate-300">아이디와 <strong className="text-cyan-200">기존 비밀번호</strong>가 일치하는 계정만 새 비밀번호로 변경됩니다.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="reset-username" className="text-slate-200">아이디</Label><Input id="reset-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="아이디 입력" className="border-slate-400/40 bg-slate-950/70 text-white placeholder:text-slate-400" /></div><div className="space-y-2"><Label htmlFor="reset-current-password" className="text-slate-200">기존 비밀번호</Label><Input id="reset-current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder="기존 비밀번호 입력" className="border-slate-400/40 bg-slate-950/70 text-white placeholder:text-slate-400" /></div><div className="space-y-2"><Label htmlFor="reset-new-password" className="text-slate-200">새 비밀번호</Label><Input id="reset-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="4자 이상 입력" className="border-slate-400/40 bg-slate-950/70 text-white placeholder:text-slate-400" /></div><div className="space-y-2"><Label htmlFor="reset-confirm-password" className="text-slate-200">새 비밀번호 확인</Label><Input id="reset-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="새 비밀번호 다시 입력" className="border-slate-400/40 bg-slate-950/70 text-white placeholder:text-slate-400" /></div><Button type="submit" disabled={submitting} className="w-full bg-cyan-600 font-semibold text-white hover:bg-cyan-500"><Shield className="mr-2 h-4 w-4" />{submitting ? "변경 중..." : "비밀번호 변경"}</Button><Button type="button" variant="ghost" onClick={() => setLocation("/login")} className="w-full text-slate-200 hover:bg-slate-800 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />로그인으로 돌아가기</Button></form></CardContent></Card></div>;
}
