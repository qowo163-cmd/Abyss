import { cn } from '@/lib/utils';
import { BookOpenCheck, Home, Users, Calculator, GitBranch, Heart, MessageSquare, Clock, LogOut, Store, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { OnlineMemberCount } from './OnlineMemberCount';
import { MarketplaceAlertSettings } from './MarketplaceAlertSettings';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface SideNavigationProps {
  currentPath: string;
  isAdmin?: boolean;
  onLogout: () => void;
  isLoggingOut?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: '홈',
    icon: <Home className="h-5 w-5" />,
    path: '/',
  },
  {
    id: 'hench',
    label: '헨치 목록',
    icon: <Users className="h-5 w-5" />,
    path: '/hench',
  },
  {
    id: 'calculator',
    label: '레벨계산기',
    icon: <Calculator className="h-5 w-5" />,
    path: '/calculator',
  },
  {
    id: 'material-calculator',
    label: '재료계산기',
    icon: <Calculator className="h-5 w-5" />,
    path: '/material-calculator',
  },
  {
    id: 'tree',
    label: '믹스법v1',
    icon: <GitBranch className="h-5 w-5" />,
    path: '/tree',
  },
  {
    id: 'tree2',
    label: '믹스법v2',
    icon: <GitBranch className="h-5 w-5" />,
    path: '/tree2',
  },
  {
    id: 'reverse-tree',
    label: '역산믹스법',
    icon: <GitBranch className="h-5 w-5" />,
    path: '/reverse',
  },
  {
    id: 'marketplace',
    label: '거래소',
    icon: <Store className="h-5 w-5" />,
    path: '/marketplace',
  },
  {
    id: 'guide',
    label: '뉴비가이드',
    icon: <BookOpenCheck className="h-5 w-5" />,
    path: '/guide',
  },
  {
    id: 'favorites',
    label: '즐겨찾기',
    icon: <Heart className="h-5 w-5" />,
    path: '/favorites',
  },
  {
    id: 'feedback',
    label: '건의사항',
    icon: <MessageSquare className="h-5 w-5" />,
    path: '/feedback',
  },
  {
    id: 'updates',
    label: '업데이트',
    icon: <Clock className="h-5 w-5" />,
    path: '/updates',
  },
];

export function SideNavigation({ currentPath, isAdmin = false, onLogout, isLoggingOut = false, collapsed = false, onToggleCollapsed = () => undefined }: SideNavigationProps) {
  return (
    <aside data-testid="sidebar-navigation" className={cn("fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sky-200/80 bg-[#eaf8ff]/92 shadow-[10px_0_30px_rgba(42,128,189,0.18)] backdrop-blur-xl transition-[width] duration-200 ease-in-out", collapsed ? "w-20" : "w-64")}>
      {/* 로고 영역 */}
      <div className={cn("border-b border-cyan-500/20", collapsed ? "p-2" : "p-4")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-200 bg-white/80 shadow-sm shadow-sky-300/40">
              <img src="/manus-storage/abyss-character-site-icon-512_6ecd4cc9.png" alt="ABYSS 캐릭터 아이콘" className="h-full w-full object-cover" decoding="async" />
            </div>
            <button type="button" onClick={onToggleCollapsed} aria-label="왼쪽 메뉴 펼치기" title="왼쪽 메뉴 펼치기" className="flex h-9 w-9 items-center justify-center rounded-lg text-sky-700 transition-colors hover:bg-white/90 hover:text-sky-950">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-200 bg-white/80 shadow-sm shadow-sky-300/40">
              <img src="/manus-storage/abyss-character-site-icon-512_6ecd4cc9.png" alt="ABYSS 캐릭터 아이콘" className="h-full w-full object-cover" decoding="async" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="text-lg font-black tracking-wide text-sky-800">ABYSS</h1>
              <p className="text-xs font-semibold text-sky-600">서버</p>
            </div>
            <button type="button" onClick={onToggleCollapsed} aria-label="왼쪽 메뉴 접기" title="왼쪽 메뉴 접기" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sky-700 transition-colors hover:bg-white/90 hover:text-sky-950">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* 네비게이션 메뉴 */}
      <nav aria-label="왼쪽 탐색 메뉴" className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;

          return (
            <Link
              key={item.id}
              href={item.path}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                'flex items-center rounded-xl py-3 transition-all duration-200',
                collapsed ? 'justify-center px-2' : 'gap-3 px-4',
                'text-sm font-bold',
                isActive
                  ? 'border border-sky-300 bg-gradient-to-r from-sky-200 to-indigo-100 text-sky-950 shadow-lg shadow-sky-300/35'
                  : 'text-slate-600 hover:bg-white/80 hover:text-sky-800'
              )}
            >
              <span className={cn('transition-colors', isActive ? 'text-sky-700' : 'text-sky-500')}>
                {item.icon}
              </span>
              <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            data-testid="sidebar-admin-dashboard-link"
            title={collapsed ? "관리자 페이지" : undefined}
            aria-label="관리자 페이지"
            className={cn("mt-3 flex items-center rounded-xl border border-violet-300 bg-violet-50 py-3 text-sm font-extrabold text-violet-900 shadow-sm shadow-violet-200/60 transition-all duration-200 hover:border-violet-500 hover:bg-violet-100", collapsed ? "justify-center px-2" : "gap-3 px-4")}
          >
            <Shield className="h-5 w-5 text-violet-700" />
            <span className={collapsed ? "sr-only" : undefined}>관리자 페이지</span>
          </Link>
        )}
      </nav>

      {/* 하단 정보 */}
      <div className={cn("border-t border-cyan-500/20", collapsed ? "p-2" : "p-4")}>
        {!collapsed && <>
          <div className="mb-3"><MarketplaceAlertSettings /></div>
          <OnlineMemberCount />
        </>}
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          data-testid="sidebar-logout-button"
          aria-label={isLoggingOut ? "로그아웃 중" : "로그아웃"}
          title={collapsed ? "로그아웃" : undefined}
          className={cn("sidebar-logout-button mb-3 flex items-center rounded-xl border border-sky-700 bg-white/90 py-2.5 text-sm font-extrabold text-sky-950 shadow-sm shadow-sky-300/45 transition-colors hover:border-sky-800 hover:bg-sky-100 hover:text-sky-950 disabled:cursor-not-allowed disabled:opacity-60", collapsed ? "w-full justify-center px-2" : "w-full justify-center gap-2 px-3")}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && (isLoggingOut ? "로그아웃 중..." : "로그아웃")}
        </button>
        {!collapsed && <p className="text-center text-xs font-medium text-sky-700">© 2024 ABYSS서버 믹스사이트</p>}
      </div>
    </aside>
  );
}
