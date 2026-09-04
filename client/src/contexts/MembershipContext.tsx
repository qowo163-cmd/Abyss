import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type MemberRole = "member" | "admin";
export type MemberStatus = "pending" | "approved" | "suspended";

export interface MemberSession {
  id: string;
  username: string;
  nickname: string;
  discordNickname: string;
  gameNickname: string;
  role: MemberRole;
  status: MemberStatus;
}

interface MembershipContextValue {
  member: MemberSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<MemberSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const payload = await response.json();
      setMember(payload?.member || null);
    } catch {
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!member) return;
    const heartbeat = () => {
      void fetch("/api/auth/heartbeat", { method: "POST", cache: "no-store" }).catch(() => undefined);
    };
    heartbeat();
    const intervalId = window.setInterval(heartbeat, 30_000);
    return () => window.clearInterval(intervalId);
  }, [member?.id]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setMember(null);
    }
  }, []);

  const value = useMemo(() => ({ member, loading, refresh, logout }), [member, loading, refresh, logout]);
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context) throw new Error("useMembership must be used inside MembershipProvider");
  return context;
}
