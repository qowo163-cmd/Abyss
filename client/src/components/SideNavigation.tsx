import { cn } from '@/lib/utils';
import { BookOpenCheck, Home, Users, Calculator, GitBranch, Heart, MessageSquare, Clock, LogOut, Store, Shield } from 'lucide-react';
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
    label: '믹스법',
    icon: <GitBranch className="h-5 w-5" />,
    path: '/tree',
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

export function SideNavigation({ currentPath, isAdmin = false, onLogout, isLoggingOut = false }: SideNavigationProps) {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-sky-200/80 bg-[#eaf8ff]/92 shadow-[10px_0_30px_rgba(42,128,189,0.18)] backdrop-blur-xl">
      {/* 로고 영역 */}
      <div className="border-b border-cyan-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-200 bg-white/80 shadow-sm shadow-sky-300/40">
              <img
                src="/manus-storage/abyss-character-site-icon-512_6ecd4cc9.png"
                alt="ABYSS 캐릭터 아이콘"
                className="h-full w-full object-cover"
                decoding="async"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-wide text-sky-800">ABYSS</h1>
              <p className="text-xs font-semibold text-sky-600">서버</p>
            </div>
          </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;

          return (
            <Link
              key={item.id}
              href={item.path}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200',
                'text-sm font-bold',
                isActive
                  ? 'border border-sky-300 bg-gradient-to-r from-sky-200 to-indigo-100 text-sky-950 shadow-lg shadow-sky-300/35'
                  : 'text-slate-600 hover:bg-white/80 hover:text-sky-800'
              )}
            >
              <span className={cn('transition-colors', isActive ? 'text-sky-700' : 'text-sky-500')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            data-testid="sidebar-admin-dashboard-link"
            className="mt-3 flex items-center gap-3 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-extrabold text-violet-900 shadow-sm shadow-violet-200/60 transition-all duration-200 hover:border-violet-500 hover:bg-violet-100"
          >
            <Shield className="h-5 w-5 text-violet-700" />
            <span>관리자 페이지</span>
          </Link>
        )}
      </nav>

      {/* 하단 정보 */}
      <div className="border-t border-cyan-500/20 p-4">
        <div className="mb-3"><MarketplaceAlertSettings /></div>
        <OnlineMemberCount />
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          data-testid="sidebar-logout-button"
          className="sidebar-logout-button mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-700 bg-white/90 px-3 py-2.5 text-sm font-extrabold text-sky-950 shadow-sm shadow-sky-300/45 transition-colors hover:border-sky-800 hover:bg-sky-100 hover:text-sky-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
        <p className="text-center text-xs font-medium text-sky-700">© 2024 ABYSS서버 믹스사이트</p>
      </div>
    </aside>
  );
}
