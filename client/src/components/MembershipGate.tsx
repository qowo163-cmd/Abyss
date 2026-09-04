import React, { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useMembership } from "@/contexts/MembershipContext";
import Login from "@/pages/Login";
import PasswordReset from "@/pages/PasswordReset";
import Register from "@/pages/Register";
import PendingApproval from "@/pages/PendingApproval";

const PUBLIC_PATHS = new Set(["/login", "/register", "/pending", "/password-reset"]);

function AccessLoading() {
  return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-300 text-sm">회원 정보를 확인하는 중입니다...</div>;
}

export function MembershipGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { member, loading, refresh } = useMembership();
  const isPublicPath = PUBLIC_PATHS.has(location);

  useEffect(() => {
    if (!loading && !member && !isPublicPath) setLocation("/login");
    if (!loading && member && isPublicPath) setLocation("/");
  }, [isPublicPath, loading, member, setLocation]);

  if (loading) return <AccessLoading />;

  if (!member && isPublicPath) {
    return (
      <Switch>
        <Route path="/login"><Login onLoginSuccess={() => void refresh()} /></Route>
        <Route path="/password-reset" component={PasswordReset} />
        <Route path="/register" component={Register} />
        <Route path="/pending" component={PendingApproval} />
      </Switch>
    );
  }

  if (!member || isPublicPath) return <AccessLoading />;
  return <>{children}</>;
}
