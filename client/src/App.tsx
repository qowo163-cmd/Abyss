import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MembershipProvider } from "./contexts/MembershipContext";
import { useMembership } from "./contexts/MembershipContext";
import { MembershipGate } from "./components/MembershipGate";
import { SideNavigation } from "./components/SideNavigation";
import MobileNavigation from "./components/MobileNavigation";
import { MarketplaceRequestNotifier } from "./components/MarketplaceRequestNotifier";
import { cn } from "./lib/utils";
import React from "react";
import { useIsMobile } from "./hooks/useMobile";
import { useAntiCapture } from "./hooks/useAntiCapture";

const MainHome = React.lazy(() => import("./pages/MainHome"));
const HenchList = React.lazy(() => import("./pages/HenchList"));
const LevelCalculator = React.lazy(() => import("./pages/LevelCalculator"));
const ReverseTree = React.lazy(() => import("./pages/ReverseTree"));
const ReverseRecipe = React.lazy(() => import("./pages/ReverseRecipe"));
const Favorites = React.lazy(() => import("./pages/Favorites"));
const Admin = React.lazy(() => import("./pages/Admin"));
const MemberManagement = React.lazy(() => import("./pages/MemberManagement"));
const Feedback = React.lazy(() => import("./pages/Feedback"));
const Updates = React.lazy(() => import("./pages/Updates"));
const Marketplace = React.lazy(() => import("./pages/Marketplace"));
const NewbieGuide = React.lazy(() => import("./pages/NewbieGuide"));

function PageLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm text-cyan-300" role="status">
      페이지를 불러오는 중입니다...
    </div>
  );
}



function Router() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { member, logout } = useMembership();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const isAdminRoute = location === "/admin" || location.startsWith("/admin/");
  const isAdministrator = member?.role === "admin";
  useAntiCapture();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setLocation("/login");
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="abyss-fantasy-shell flex min-h-screen flex-col md:flex-row">
      {/* 좌측 사이드 네비게이션 - 데스크톱 */}
      {!isMobile && !isAdminRoute && <SideNavigation currentPath={location} isAdmin={isAdministrator} onLogout={() => void handleLogout()} isLoggingOut={isLoggingOut} />}

      {/* 메인 콘테츠 */}
      <main className={cn("flex-1 pb-20 md:pb-0", !isAdminRoute && "md:ml-64")}>
        <React.Suspense fallback={<PageLoadingFallback />}>
          <Switch>
            <Route path={"/"} component={MainHome} />
            <Route path={"/hench"} component={HenchList} />
            <Route path={"/calculator"} component={LevelCalculator} />
            <Route path={"/tree"} component={ReverseTree} />
            <Route path={"/reverse"} component={ReverseRecipe} />
            <Route path={"/marketplace"} component={Marketplace} />
            <Route path={"/guide"} component={NewbieGuide} />
            <Route path={"/admin"} component={Admin} />
            <Route path={"/admin/*"} component={Admin} />
            <Route path={"/members"} component={() => <MemberManagement />} />
            <Route path={"/feedback"} component={Feedback} />
            <Route path={"/updates"} component={Updates} />
            <Route path={"/favorites"} component={Favorites} />
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </React.Suspense>
      </main>

      <MarketplaceRequestNotifier memberId={member?.id ?? null} />
      {isMobile && !isAdminRoute && <MobileNavigation currentPath={location} isAdmin={isAdministrator} isLoggingOut={isLoggingOut} onLogout={() => void handleLogout()} />}
    </div>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  React.useEffect(() => {
    document.title = localStorage.getItem('siteTitle') || 'ABYSS서버 믹스사이트';
  }, []);

  // 방문자 수 증가
  React.useEffect(() => {
    const lastVisit = localStorage.getItem('lastVisit');
    const today = new Date().toDateString();
    
    if (lastVisit !== today) {
      const count = parseInt(localStorage.getItem('visitorCount') || '0');
      localStorage.setItem('visitorCount', (count + 1).toString());
      localStorage.setItem('lastVisit', today);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <MembershipProvider>
            <MembershipGate>
              <Router />
            </MembershipGate>
          </MembershipProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
