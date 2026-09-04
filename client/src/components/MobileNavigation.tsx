import { BookOpenCheck, Calculator, CircleEllipsis, GitBranch, Heart, Home, LogOut, MessageSquare, Shield, Store, Users } from "lucide-react";
import { Link } from "wouter";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MarketplaceAlertSettings } from "./MarketplaceAlertSettings";

type MobileNavItem = {
  label: string;
  path: string;
  icon: typeof Home;
};

const PRIMARY_ITEMS: MobileNavItem[] = [
  { label: "홈", path: "/", icon: Home },
  { label: "헨치", path: "/hench", icon: Users },
  { label: "믹스법", path: "/tree", icon: GitBranch },
  { label: "거래소", path: "/marketplace", icon: Store },
  { label: "가이드", path: "/guide", icon: BookOpenCheck },
];

const MORE_ITEMS: MobileNavItem[] = [
  { label: "레벨계산기", path: "/calculator", icon: Calculator },
  { label: "역산믹스법", path: "/reverse", icon: GitBranch },
  { label: "즐겨찾기", path: "/favorites", icon: Heart },
  { label: "건의사항", path: "/feedback", icon: MessageSquare },
];

function isActivePath(currentPath: string, itemPath: string) {
  return itemPath === "/" ? currentPath === "/" : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export default function MobileNavigation({
  currentPath,
  isAdmin,
  isLoggingOut = false,
  onLogout,
}: {
  currentPath: string;
  isAdmin: boolean;
  isLoggingOut?: boolean;
  onLogout: () => void;
}) {
  return (
    <nav aria-label="모바일 주요 탐색" className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-sky-200/90 bg-[#eefaff]/96 px-1 pb-[max(0.3rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_24px_rgba(27,105,151,0.14)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-stretch justify-between gap-px">
        {PRIMARY_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(currentPath, item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex min-h-14 min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-extrabold tracking-[-0.03em] transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] min-[390px]:px-1 min-[390px]:text-[11px]",
                active ? "bg-sky-700 text-white shadow-sm shadow-sky-800/30" : "text-sky-800 hover:bg-white/85",
              )}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" aria-label="전체 메뉴" className="flex min-h-14 min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-extrabold tracking-[-0.03em] text-sky-800 transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/85 active:scale-[0.97] min-[390px]:px-1 min-[390px]:text-[11px]">
              <CircleEllipsis aria-hidden="true" className="size-[18px]" />
              <span className="whitespace-nowrap">메뉴</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[78dvh] rounded-t-3xl border-sky-200 bg-[#f8fdff] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 text-sky-950">
            <SheetHeader className="px-1 pb-3 pt-2 text-left">
              <SheetTitle className="text-lg font-black text-sky-950">전체 메뉴</SheetTitle>
              <SheetDescription className="text-sky-800">승인 회원이 이용할 수 있는 기능입니다.</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SheetClose key={item.path} asChild>
                    <Link href={item.path} className="flex min-h-14 min-w-0 items-center gap-2 rounded-2xl border border-sky-200 bg-white px-3 text-[13px] font-extrabold text-sky-900 shadow-sm shadow-sky-100/80 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-sky-400 hover:bg-sky-50 active:scale-[0.98] min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:text-sm">
                      <Icon aria-hidden="true" className="size-5 text-sky-700" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
              {isAdmin && (
                <SheetClose asChild>
                  <Link href="/admin" className="flex min-h-14 min-w-0 items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 text-[13px] font-extrabold text-violet-900 shadow-sm shadow-violet-100/80 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-violet-400 hover:bg-violet-100 active:scale-[0.98] min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:text-sm">
                    <Shield aria-hidden="true" className="size-5 text-violet-700" />
                    <span className="whitespace-nowrap">관리자 대시보드</span>
                  </Link>
                </SheetClose>
              )}
              <SheetClose asChild>
                <button type="button" onClick={onLogout} disabled={isLoggingOut} className="flex min-h-14 min-w-0 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-[13px] font-extrabold text-rose-900 shadow-sm shadow-rose-100/80 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-rose-400 hover:bg-rose-100 active:scale-[0.98] min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:text-sm disabled:cursor-not-allowed disabled:opacity-60">
                  <LogOut aria-hidden="true" className="size-5 text-rose-700" />
                  <span className="whitespace-nowrap">{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
                </button>
              </SheetClose>
            </div>
            <div className="mt-3"><MarketplaceAlertSettings compact /></div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
