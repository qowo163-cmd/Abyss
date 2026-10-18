import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, UserPlus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [discordNickname, setDiscordNickname] = useState("");
  const [gameNickname, setGameNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !nickname || !discordNickname || !gameNickname) {
      toast.error("모든 항목을 빠짐없이 입력해 주세요.");
      return;
    }
    if (username.length < 4 || username.length > 24) {
      toast.error("아이디는 영문 소문자·숫자·밑줄로 4~24자여야 합니다.");
      return;
    }
    if (password.length < 4) {
      toast.error("비밀번호는 4자 이상이어야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, nickname, discordNickname, gameNickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "회원가입에 실패했습니다.");
      }
      toast.success("회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
      setLocation("/pending");
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "회원가입 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/90 border-cyan-500/30 text-white shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-cyan-500/10 rounded-full border border-cyan-500/30">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-cyan-300">회원가입</CardTitle>
          <CardDescription className="text-slate-400">
            믹스마스터 DB 이용을 위한 계정 정보를 입력하세요. 관리자 승인 후 이용 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">아이디 (영문·숫자 4~24자)</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">비밀번호 (4자 이상)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="bg-slate-800 border-slate-700 text-white"
                minLength={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-slate-300">닉네임</Label>
              <Input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용할 닉네임"
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discordNickname" className="text-slate-300">디스코드 닉네임 (1자 이상)</Label>
              <Input
                id="discordNickname"
                type="text"
                value={discordNickname}
                onChange={(e) => setDiscordNickname(e.target.value)}
                placeholder="예: user#1234 또는 username"
                className="bg-slate-800 border-slate-700 text-white"
                minLength={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gameNickname" className="text-slate-300">인게임 닉네임 (1자 이상)</Label>
              <Input
                id="gameNickname"
                type="text"
                value={gameNickname}
                onChange={(e) => setGameNickname(e.target.value)}
                placeholder="게임 내 캐릭터 닉네임 (1글자 허용)"
                className="bg-slate-800 border-slate-700 text-white"
                minLength={1}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {submitting ? "가입 요청 중..." : "회원가입 신청"}
            </Button>

            <div className="flex justify-between items-center pt-2 text-sm">
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                로그인 화면으로 돌아가기
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
