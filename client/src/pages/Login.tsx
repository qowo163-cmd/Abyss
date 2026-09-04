import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, LogIn, UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "PENDING_APPROVAL") {
          toast.error("관리자 승인 대기 중인 계정입니다.");
          setLocation("/pending");
          return;
        }
        throw new Error(data.message || "로그인에 실패했습니다.");
      }
      toast.success("로그인 성공!");
      onLoginSuccess();
      setLocation("/");
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center p-4">
      <img
        aria-hidden="true"
        data-testid="login-background"
        src="/manus-storage/abyss-login-background-no-text_2b2ef8a0.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        decoding="async"
        fetchPriority="high"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/30 to-slate-950/60" />
      <Card className="relative z-10 w-full max-w-md bg-slate-950/85 border-cyan-300/40 text-white shadow-2xl shadow-slate-950/70 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-cyan-500/10 rounded-full border border-cyan-500/30">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-cyan-300">ABYSS서버 믹스사이트 로그인</CardTitle>
          <CardDescription className="text-slate-400">
            승인된 회원 계정으로 로그인하여 사이트를 이용하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">아이디</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                className="bg-slate-950/70 border-slate-400/40 text-white placeholder:text-slate-400 focus-visible:border-cyan-300"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="bg-slate-950/70 border-slate-400/40 text-white placeholder:text-slate-400 focus-visible:border-cyan-300"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {submitting ? "로그인 중..." : "로그인"}
            </Button>

            <div className="flex flex-wrap justify-between gap-3 pt-2 text-sm">
              <button type="button" onClick={() => setLocation("/password-reset")} className="flex items-center gap-1 font-medium text-cyan-300 hover:underline"><KeyRound className="h-4 w-4" />비밀번호 재설정</button>
              <button type="button" onClick={() => setLocation("/register")} className="flex items-center gap-1 font-medium text-cyan-400 hover:underline"><UserPlus className="h-4 w-4" />회원가입 신청</button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
