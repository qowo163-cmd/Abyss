import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, ArrowLeft } from "lucide-react";

export default function PendingApproval() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/90 border-cyan-500/30 text-white shadow-2xl text-center">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/30">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-amber-300">관리자 승인 대기 중</CardTitle>
          <CardDescription className="text-slate-400">
            회원가입 신청이 정상적으로 접수되었습니다. 관리자가 가입 정보를 확인한 후 승인하면 로그인이 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            디스코드 닉네임과 인게임 닉네임이 정확한지 확인해 주세요. 승인 완료 후 로그인하실 수 있습니다.
          </p>
          <Button
            onClick={() => setLocation("/login")}
            className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-semibold py-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            로그인 화면으로 이동
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
