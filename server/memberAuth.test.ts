import { afterEach, describe, expect, it } from "vitest";
import {
  MemberAuthError,
  changeMemberStatus,
  changeMemberPasswordByCredentials,
  deleteMember,
  findMemberById,
  getAdminSetupReadiness,
  getMemberFromToken,
  getSessionTokenFromHeader,
  listMemberIpAccessLogs,
  loginMember,
  logoutMember,
  normalizeClientIp,
  registerMember,
  resetMemberPasswordByAdministrator,
  revokeSession,
  saveMemberExpoPushToken,
  sessionCookieHeader,
  setMemberAuthPoolForTesting,
  type PublicMember,
} from "./memberAuth";

type StoredMember = PublicMember & { passwordHash: string; approvedBy: string | null };
type StoredSession = { id: string; memberId: string; tokenHash: string; expiresAt: Date };
type LoginAttempt = { failureCount: number; windowStartedAt: Date; lockedUntil: Date | null };
type IpAccessLog = { id: string; memberId: string; ipAddress: string; firstSeenAt: string; lastSeenAt: string };

function createMemberAuthPool() {
  const members: StoredMember[] = [];
  const sessions: StoredSession[] = [];
  const loginAttempts = new Map<string, LoginAttempt>();
  const ipLogs: IpAccessLog[] = [];
  const rowFor = (member: StoredMember) => ({ ...member, approvedAt: member.approvedAt, createdAt: member.createdAt });
  const pool = {
    async query(sql: string, values: unknown[] = []) {
      if (sql.includes("FROM member_login_attempts")) {
        const attempt = loginAttempts.get(String(values[0]));
        return [[attempt ? { failureCount: attempt.failureCount, windowStartedAt: attempt.windowStartedAt, lockedUntil: attempt.lockedUntil } : undefined].filter(Boolean), []];
      }
      if (sql.includes("FROM member_accounts WHERE username")) {
        const username = String(values[0]);
        const member = members.find((candidate) => candidate.username === username);
        return [[member ? rowFor(member) : undefined].filter(Boolean), []];
      }
      if (sql.includes("FROM member_accounts WHERE id")) {
        const member = members.find((candidate) => candidate.id === String(values[0]));
        return [[member ? rowFor(member) : undefined].filter(Boolean), []];
      }
      if (sql.includes("FROM member_sessions s INNER JOIN member_accounts m")) {
        const session = sessions.find((candidate) => candidate.tokenHash === String(values[0]) && candidate.expiresAt.getTime() > Date.now());
        const member = session ? members.find((candidate) => candidate.id === session.memberId) : undefined;
        return [[member ? rowFor(member) : undefined].filter(Boolean), []];
      }
      if (sql.includes("FROM member_ip_access_logs")) {
        return [ipLogs.filter((log) => log.memberId === String(values[0])).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)), []];
      }
      throw new Error(`Unhandled query: ${sql}`);
    },
    async execute(sql: string, values: unknown[] = []) {
      if (sql.includes("member_device_push_tokens")) {
        return [[], []];
      }
      if (sql.includes("INSERT INTO member_accounts")) {
        members.push({
          id: String(values[0]), username: String(values[1]), passwordHash: String(values[2]), nickname: String(values[3]),
          discordNickname: String(values[4]), gameNickname: String(values[5]), role: "member", status: "pending",
          approvedAt: null, approvedBy: null, lastActivityAt: null, lastIpAddress: null, createdAt: new Date().toISOString(),
        });
        return [[], []];
      }
      if (sql.includes("INSERT INTO member_sessions")) {
        sessions.push({ id: String(values[0]), memberId: String(values[1]), tokenHash: String(values[2]), expiresAt: values[3] as Date });
        return [[], []];
      }
      if (sql.includes("INSERT INTO member_login_attempts")) {
        loginAttempts.set(String(values[0]), { failureCount: Number(values[1]), windowStartedAt: values[2] as Date, lockedUntil: values[3] as Date | null });
        return [[], []];
      }
      if (sql.includes("UPDATE member_login_attempts SET failure_count")) {
        loginAttempts.set(String(values[3]), { failureCount: Number(values[0]), windowStartedAt: values[1] as Date, lockedUntil: values[2] as Date | null });
        return [[], []];
      }
      if (sql.includes("DELETE FROM member_login_attempts")) {
        loginAttempts.delete(String(values[0]));
        return [[], []];
      }
      if (sql.includes("UPDATE member_accounts SET last_activity_at = NOW(), last_ip_address")) {
        const member = members.find((candidate) => candidate.id === String(values[1]));
        if (member) { member.lastActivityAt = new Date().toISOString(); member.lastIpAddress = String(values[0]); }
        return [[], []];
      }
      if (sql.includes("UPDATE member_accounts SET last_activity_at")) {
        const member = members.find((candidate) => candidate.id === String(values[0]));
        if (member) member.lastActivityAt = new Date().toISOString();
        return [[], []];
      }
      if (sql.includes("INSERT INTO member_ip_access_logs")) {
        const memberId = String(values[1]);
        const ipAddress = String(values[2]);
        const existing = ipLogs.find((log) => log.memberId === memberId && log.ipAddress === ipAddress);
        if (existing) existing.lastSeenAt = new Date().toISOString();
        else ipLogs.push({ id: String(values[0]), memberId, ipAddress, firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
        return [[], []];
      }
      if (sql.includes("UPDATE member_accounts SET status = ?, approved_at = NOW()")) {
        const member = members.find((candidate) => candidate.id === String(values[2]));
        if (member) { member.status = "approved"; member.approvedAt = new Date().toISOString(); member.approvedBy = String(values[1]); }
        return [[], []];
      }
      if (sql.includes("UPDATE member_accounts SET password_hash")) {
        const member = members.find((candidate) => candidate.id === String(values[1]));
        if (member) member.passwordHash = String(values[0]);
        return [[], []];
      }
      if (sql.includes("UPDATE member_accounts SET status = ?, approved_at = NULL")) {
        const member = members.find((candidate) => candidate.id === String(values[1]));
        if (member) { member.status = String(values[0]) as "pending" | "suspended"; member.approvedAt = null; member.approvedBy = null; }
        return [[], []];
      }
      if (sql.includes("DELETE FROM member_sessions WHERE member_id")) {
        const memberId = String(values[0]);
        for (let index = sessions.length - 1; index >= 0; index -= 1) if (sessions[index].memberId === memberId) sessions.splice(index, 1);
        return [[], []];
      }
      if (sql.includes("DELETE FROM member_sessions WHERE token_hash")) {
        const tokenHash = String(values[0]);
        for (let index = sessions.length - 1; index >= 0; index -= 1) if (sessions[index].tokenHash === tokenHash) sessions.splice(index, 1);
        return [[], []];
      }
      if (sql.includes("DELETE FROM member_ip_access_logs")) {
        const memberId = String(values[0]);
        for (let index = ipLogs.length - 1; index >= 0; index -= 1) if (ipLogs[index].memberId === memberId) ipLogs.splice(index, 1);
        return [[], []];
      }
      if (sql.includes("DELETE FROM member_accounts WHERE id")) {
        const memberId = String(values[0]);
        const index = members.findIndex((candidate) => candidate.id === memberId);
        if (index >= 0) members.splice(index, 1);
        return [[], []];
      }
      throw new Error(`Unhandled execute: ${sql}`);
    },
  };
  return pool;
}

describe("initial administrator credential configuration", () => {
  it("reports a ready state when the managed administrator credentials are valid", () => {
    expect(getAdminSetupReadiness()).toEqual({ ready: true });
  });
});

describe("member registration, approval, and session lifecycle", () => {
  afterEach(() => setMemberAuthPoolForTesting(undefined));

  it("allows 1-character discord and game nicknames during registration", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const registered = await registerMember({
      username: "short_nick", password: "safe-password-123", nickname: "테스트", discordNickname: "a", gameNickname: "b",
    });
    expect(registered.username).toBe("short_nick");
  });

  it("issues a browser-session cookie without persistent Max-Age or Expires attributes", () => {
    const header = sessionCookieHeader("session-token");

    expect(header).toContain("__Host-mixmaster-member-session=session-token");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).not.toMatch(/(?:Max-Age|Expires)=/i);
  });

  it("blocks a pending account, allows it after approval, and invalidates access when suspended or logged out", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const registered = await registerMember({
      username: "new_member", password: "safe-password-123", nickname: "새 회원", discordNickname: "newmember", gameNickname: "테스트헨치",
    });
    expect(registered.status).toBe("pending");
    await expect(loginMember("new_member", "safe-password-123")).rejects.toMatchObject<MemberAuthError>({ code: "PENDING_APPROVAL" });

    const approved = await changeMemberStatus(registered.id, "approved", "admin-1");
    expect(approved.status).toBe("approved");
    const session = await loginMember("new_member", "safe-password-123");
    expect((await getMemberFromToken(session.token))?.id).toBe(registered.id);

    await revokeSession(session.token);
    expect(await getMemberFromToken(session.token)).toBeNull();

    await changeMemberStatus(registered.id, "suspended", "admin-1");
    await expect(loginMember("new_member", "safe-password-123")).rejects.toMatchObject<MemberAuthError>({ code: "SUSPENDED" });
  });

  it("allows a four-character password and prevents a deleted member from logging in", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const registered = await registerMember({
      username: "short_pass", password: "1234", nickname: "짧은 비번", discordNickname: "shortpass", gameNickname: "짧은헨치",
    });
    await changeMemberStatus(registered.id, "approved", "admin-1");
    const session = await loginMember("short_pass", "1234");
    expect((await getMemberFromToken(session.token))?.lastActivityAt).toBeTruthy();

    await deleteMember(registered.id, "admin-1");
    expect(await getMemberFromToken(session.token)).toBeNull();
    await expect(loginMember("short_pass", "1234")).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_CREDENTIALS" });
  });

  it("changes only the named member password after validating that member's current password and invalidates old sessions", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const first = await registerMember({ username: "first_user", password: "first-old", nickname: "첫 회원", discordNickname: "first", gameNickname: "첫헨치" });
    const second = await registerMember({ username: "second_user", password: "second-old", nickname: "둘 회원", discordNickname: "second", gameNickname: "둘헨치" });
    await changeMemberStatus(first.id, "approved", "admin-1");
    await changeMemberStatus(second.id, "approved", "admin-1");
    const oldSession = await loginMember(first.username, "first-old");

    await expect(changeMemberPasswordByCredentials({ username: first.username, currentPassword: "wrong-password", newPassword: "first-new" })).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_CREDENTIALS" });
    await changeMemberPasswordByCredentials({ username: first.username, currentPassword: "first-old", newPassword: "first-new" });

    expect(await getMemberFromToken(oldSession.token)).toBeNull();
    await expect(loginMember(first.username, "first-old")).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_CREDENTIALS" });
    expect((await loginMember(first.username, "first-new")).member.id).toBe(first.id);
    expect((await loginMember(second.username, "second-old")).member.id).toBe(second.id);
  });

  it("lets an administrator reset a regular member password to 1234 and rejects a self-target", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const member = await registerMember({ username: "reset_user", password: "member-old", nickname: "초기화 회원", discordNickname: "reset", gameNickname: "초기화헨치" });
    await changeMemberStatus(member.id, "approved", "admin-1");
    const activeSession = await loginMember(member.username, "member-old");

    await resetMemberPasswordByAdministrator(member.id, "admin-1");

    expect(await getMemberFromToken(activeSession.token)).toBeNull();
    await expect(loginMember(member.username, "member-old")).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_CREDENTIALS" });
    expect((await loginMember(member.username, "1234")).member.id).toBe(member.id);
    await expect(resetMemberPasswordByAdministrator(member.id, member.id)).rejects.toMatchObject<MemberAuthError>({ code: "FORBIDDEN" });
  });

  it("records the logout instant as the member's last activity before invalidating the session", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const registered = await registerMember({
      username: "logout_time", password: "1234", nickname: "종료 시각", discordNickname: "logout", gameNickname: "종료헨치",
    });
    await changeMemberStatus(registered.id, "approved", "admin-1");
    const session = await loginMember("logout_time", "1234");
    const beforeLogout = await findMemberById(registered.id);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await logoutMember(session.token);

    const afterLogout = await findMemberById(registered.id);
    expect(afterLogout?.lastActivityAt).toBeTruthy();
    expect(new Date(afterLogout!.lastActivityAt!).getTime()).toBeGreaterThan(new Date(beforeLogout!.lastActivityAt!).getTime());
    expect(await getMemberFromToken(session.token)).toBeNull();
  });

  it("records a validated successful-login IP once and exposes it through the administrator IP history helper", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const registered = await registerMember({ username: "ip_audit", password: "1234", nickname: "IP 확인", discordNickname: "ipaudit", gameNickname: "IP헨치" });
    await changeMemberStatus(registered.id, "approved", "admin-1");

    await loginMember("ip_audit", "1234", "::ffff:203.0.113.42");
    await loginMember("ip_audit", "1234", "203.0.113.42");

    expect((await findMemberById(registered.id))?.lastIpAddress).toBe("203.0.113.42");
    expect(await listMemberIpAccessLogs(registered.id)).toMatchObject([{ memberId: registered.id, ipAddress: "203.0.113.42" }]);
    expect(normalizeClientIp("not-an-ip")).toBeNull();
  });

  it("temporarily blocks login after repeated incorrect password attempts", async () => {
    setMemberAuthPoolForTesting(createMemberAuthPool() as never);
    const registered = await registerMember({
      username: "limited_user", password: "1234", nickname: "제한 회원", discordNickname: "limited", gameNickname: "제한헨치",
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(loginMember(registered.username, "wrong-password")).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_CREDENTIALS" });
    }
    await expect(loginMember(registered.username, "wrong-password")).rejects.toMatchObject<MemberAuthError>({ code: "LOGIN_RATE_LIMITED" });
  });

  it("accepts a valid native Bearer session while preserving the browser cookie flow", () => {
    const token = "A".repeat(43);
    expect(getSessionTokenFromHeader("__Host-mixmaster-member-session=cookie-token")).toBe("cookie-token");
    expect(getSessionTokenFromHeader("__Host-mixmaster-member-session=cookie-token", `Bearer ${token}`)).toBe(token);
    expect(getSessionTokenFromHeader(undefined, "Bearer too-short")).toBeUndefined();
  });

  it("stores supported Android and iPhone device platforms and rejects other platform values", async () => {
    const calls: unknown[][] = [];
    setMemberAuthPoolForTesting({ execute: async (_sql: string, values: unknown[] = []) => { calls.push(values); return [[], []]; } } as never);

    await saveMemberExpoPushToken("member-1", "ExpoPushToken[device-ios-1]", true, "ios");
    expect(calls[0]).toEqual([expect.any(String), "member-1", "ExpoPushToken[device-ios-1]", "ios", 1]);
    await expect(saveMemberExpoPushToken("member-1", "ExpoPushToken[device-web-1]", true, "web")).rejects.toMatchObject<MemberAuthError>({ code: "INVALID_INPUT" });
  });
});
