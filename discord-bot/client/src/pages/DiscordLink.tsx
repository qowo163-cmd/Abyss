import * as React from "react";
import { useMembership } from "@/contexts/MembershipContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DiscordLink() {
  const { member } = useMembership();
  const [code, setCode] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const create = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/discord-link-code", { method: "POST", credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "연동 코드를 만들 수 없습니다.");
      setCode(data.code);
    } catch (e) { setError(e instanceof Error ? e.message : "연동 코드를 만들 수 없습니다."); }
    finally { setLoading(false); }
  };
  return <div className="mx-auto max-w-xl p-6">
    <Card>
      <CardHeader><CardTitle>Discord 연동</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-300">Abyss 계정과 Discord 계정을 연결하면 Discord에서 거래소를 조회하고 거래/교환 등록을 할 수 있으며, 사이트 거래 요청을 Discord DM으로 받을 수 있습니다.</p>
        <p className="text-sm text-slate-400">현재 로그인: {member?.nickname ?? "-"}</p>
        <Button onClick={() => void create()} disabled={loading}>{loading ? "생성 중..." : "연동 코드 생성"}</Button>
        {code && <div className="rounded-lg border border-cyan-500/40 bg-slate-950 p-5 text-center"><p className="text-xs text-slate-400">Discord에서 아래 명령어를 입력하세요.</p><p className="mt-2 font-mono text-3xl tracking-widest text-cyan-300">{code}</p><p className="mt-2 text-sm text-slate-300">/link code:{code}</p><p className="mt-2 text-xs text-amber-300">코드는 10분 후 만료됩니다.</p></div>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
    </Card>
  </div>;
}
