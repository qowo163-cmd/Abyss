import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isIP } from "node:net";
import mysql, { type Pool } from "mysql2/promise";

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
export const MEMBER_SESSION_COOKIE = "__Host-mixmaster-member-session";

export type MemberRole = "member" | "admin";
export type MemberStatus = "pending" | "approved" | "suspended";
export const SECURITY_EVENT_TYPES = [
  "focus_lost",
  "tab_hidden",
  "print_requested",
  "copy_shortcut",
  "save_shortcut",
  "developer_tools_shortcut",
  "print_screen_key",
  "context_menu",
  "drag_attempt",
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export interface SecurityEvent {
  id: string;
  memberId: string;
  memberUsername: string;
  memberNickname: string;
  eventType: SecurityEventType;
  path: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface MemberIpAccessLog {
  id: string;
  memberId: string;
  ipAddress: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MemberExpoPushToken {
  token: string;
}

export type MemberPushPlatform = "android" | "ios";

export interface PublicMember {
  id: string;
  username: string;
  nickname: string;
  discordNickname: string;
  gameNickname: string;
  role: MemberRole;
  status: MemberStatus;
  approvedAt: string | null;
  lastActivityAt: string | null;
  lastIpAddress: string | null;
  createdAt: string;
}

interface MemberRecord extends PublicMember {
  passwordHash: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  nickname: string;
  discordNickname: string;
  gameNickname: string;
}

export class MemberAuthError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "DUPLICATE_USERNAME" | "INVALID_CREDENTIALS" | "PENDING_APPROVAL" | "SUSPENDED" | "LOGIN_RATE_LIMITED" | "UNAUTHORIZED" | "FORBIDDEN" | "SETUP_ERROR",
    message: string,
  ) {
    super(message);
  }
}

let pool: Pool | undefined;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_DURATION_MS = 5 * 60 * 1000;
const ACTIVE_MEMBER_WINDOW_SECONDS = 90;

export function setMemberAuthPoolForTesting(testPool: Pool | undefined) {
  pool = testPool;
}

function getPool(): Pool {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new MemberAuthError("SETUP_ERROR", "회원 데이터베이스가 설정되지 않았습니다.");
  pool = mysql.createPool(databaseUrl);
  return pool;
}

function normalizeExpoPushToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!/^(?:ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(token) || token.length > 255) {
    throw new MemberAuthError("INVALID_INPUT", "유효하지 않은 기기 푸시 알림 토큰입니다.");
  }
  return token;
}

function normalizeMemberPushPlatform(value: unknown): MemberPushPlatform {
  if (value === "android" || value === "ios") return value;
  throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 기기 플랫폼입니다.");
}

export async function saveMemberExpoPushToken(memberId: string, rawToken: unknown, enabled = true, rawPlatform: unknown = "android"): Promise<void> {
  const expoPushToken = normalizeExpoPushToken(rawToken);
  const platform = normalizeMemberPushPlatform(rawPlatform);
  await getPool().execute(
    `INSERT INTO member_device_push_tokens
      (id, member_id, expo_push_token, platform, enabled, last_error, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, NOW(), NOW())
     ON DUPLICATE KEY UPDATE member_id = VALUES(member_id), platform = VALUES(platform), enabled = VALUES(enabled), last_error = NULL, last_seen_at = NOW()`,
    [randomUUID(), memberId, expoPushToken, platform, enabled ? 1 : 0],
  );
}

export async function listMemberExpoPushTokens(memberId: string): Promise<MemberExpoPushToken[]> {
  const [rows] = await getPool().query(
    `SELECT expo_push_token AS token FROM member_device_push_tokens
     WHERE member_id = ? AND platform IN ('android', 'ios') AND enabled = 1
     ORDER BY last_seen_at DESC`,
    [memberId],
  );
  return Array.isArray(rows)
    ? rows
        .map((row) => {
          const token = (row as Record<string, unknown>).token;
          return typeof token === "string" && token.length > 0 ? { token } : null;
        })
        .filter((row): row is MemberExpoPushToken => row !== null)
    : [];
}

export async function disableMemberExpoPushToken(rawToken: unknown, reason: string): Promise<void> {
  const expoPushToken = normalizeExpoPushToken(rawToken);
  await getPool().execute(
    "UPDATE member_device_push_tokens SET enabled = 0, last_error = ? WHERE expo_push_token = ?",
    [reason.slice(0, 160), expoPushToken],
  );
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeText(value: string): string {
  return value.trim();
}

function assertRegistrationInput(input: RegisterInput) {
  const username = normalizeUsername(input.username);
  const nickname = normalizeText(input.nickname);
  const discordNickname = normalizeText(input.discordNickname);
  const gameNickname = normalizeText(input.gameNickname);

  if (!/^[a-z0-9_]{4,24}$/.test(username)) {
    throw new MemberAuthError("INVALID_INPUT", "아이디는 영문 소문자·숫자·밑줄로 4~24자여야 합니다.");
  }
  if (input.password.length < 4 || input.password.length > 128) {
    throw new MemberAuthError("INVALID_INPUT", "비밀번호는 4~128자로 입력해 주세요.");
  }
  for (const [label, value, min, max] of [
    ["닉네임", nickname, 2, 40],
    ["디스코드 닉네임", discordNickname, 1, 80],
    ["인게임 닉네임", gameNickname, 1, 80],
  ] as const) {
    if (value.length < min || value.length > max) {
      throw new MemberAuthError("INVALID_INPUT", min === 1 ? `${label}은 1~${max}자로 입력해 주세요.` : `${label}은 ${min}~${max}자로 입력해 주세요.`);
    }
  }

  return { username, nickname, discordNickname, gameNickname };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, serialized: string): Promise<boolean> {
  const [algorithm, salt, stored] = serialized.split("$");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(stored, "base64url");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function assertPasswordValue(password: unknown, label: string): asserts password is string {
  if (typeof password !== "string" || password.length < 4 || password.length > 128) {
    throw new MemberAuthError("INVALID_INPUT", `${label}는 4~128자로 입력해 주세요.`);
  }
}

function loginAttemptKey(username: string) {
  return createHash("sha256").update(normalizeUsername(username)).digest("hex");
}

function parseTimestamp(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function normalizeClientIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().replace(/^::ffff:/i, "");
  return isIP(candidate) ? candidate.slice(0, 45) : null;
}

async function assertLoginNotLocked(username: string) {
  const [rows] = await getPool().query(
    "SELECT failure_count AS failureCount, locked_until AS lockedUntil FROM member_login_attempts WHERE attempt_key = ? LIMIT 1",
    [loginAttemptKey(username)],
  );
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  const lockedUntil = parseTimestamp(row?.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    const seconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
    throw new MemberAuthError("LOGIN_RATE_LIMITED", `로그인 시도가 많아 ${seconds}초 후 다시 시도할 수 있습니다.`);
  }
}

async function recordLoginFailure(username: string) {
  const attemptKey = loginAttemptKey(username);
  const [rows] = await getPool().query(
    "SELECT failure_count AS failureCount, window_started_at AS windowStartedAt FROM member_login_attempts WHERE attempt_key = ? LIMIT 1",
    [attemptKey],
  );
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  const now = Date.now();
  const windowStartedAt = parseTimestamp(row?.windowStartedAt);
  const resetWindow = !windowStartedAt || now - windowStartedAt.getTime() > LOGIN_FAILURE_WINDOW_MS;
  const nextFailureCount = resetWindow ? 1 : Number(row?.failureCount || 0) + 1;
  const lockedUntil = nextFailureCount >= LOGIN_FAILURE_LIMIT ? new Date(now + LOGIN_LOCK_DURATION_MS) : null;

  if (!row) {
    await getPool().execute(
      "INSERT INTO member_login_attempts (attempt_key, failure_count, window_started_at, locked_until) VALUES (?, ?, ?, ?)",
      [attemptKey, nextFailureCount, new Date(now), lockedUntil],
    );
    return;
  }
  await getPool().execute(
    "UPDATE member_login_attempts SET failure_count = ?, window_started_at = ?, locked_until = ? WHERE attempt_key = ?",
    [nextFailureCount, resetWindow ? new Date(now) : windowStartedAt, lockedUntil, attemptKey],
  );
}

async function clearLoginFailures(username: string) {
  await getPool().execute("DELETE FROM member_login_attempts WHERE attempt_key = ?", [loginAttemptKey(username)]);
}

function toPublicMember(row: Record<string, unknown>): PublicMember {
  const timestamp = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);
  return {
    id: String(row.id),
    username: String(row.username),
    nickname: String(row.nickname),
    discordNickname: String(row.discordNickname),
    gameNickname: String(row.gameNickname),
    role: row.role as MemberRole,
    status: row.status as MemberStatus,
    approvedAt: timestamp(row.approvedAt),
    lastActivityAt: timestamp(row.lastActivityAt),
    lastIpAddress: row.lastIpAddress ? String(row.lastIpAddress) : null,
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
  };
}

function toMemberIpAccessLog(row: Record<string, unknown>): MemberIpAccessLog {
  const timestamp = (value: unknown) => value instanceof Date ? value.toISOString() : value ? String(value) : new Date(0).toISOString();
  return {
    id: String(row.id),
    memberId: String(row.memberId),
    ipAddress: String(row.ipAddress),
    firstSeenAt: timestamp(row.firstSeenAt),
    lastSeenAt: timestamp(row.lastSeenAt),
  };
}

function toMemberRecord(row: Record<string, unknown>): MemberRecord {
  return { ...toPublicMember(row), passwordHash: String(row.passwordHash) };
}

function toSecurityEvent(row: Record<string, unknown>): SecurityEvent {
  const timestamp = (value: unknown) => value instanceof Date ? value.toISOString() : value ? String(value) : null;
  return {
    id: String(row.id),
    memberId: String(row.memberId),
    memberUsername: String(row.memberUsername),
    memberNickname: String(row.memberNickname),
    eventType: row.eventType as SecurityEventType,
    path: String(row.path),
    createdAt: timestamp(row.createdAt) || new Date(0).toISOString(),
    acknowledgedAt: timestamp(row.acknowledgedAt),
    acknowledgedBy: row.acknowledgedBy ? String(row.acknowledgedBy) : null,
  };
}

function normalizeSecurityEventPath(value: unknown) {
  if (typeof value !== "string") return "/";
  const path = value.trim().slice(0, 255);
  return path.startsWith("/") ? path : "/";
}

function assertSecurityEventType(value: unknown): asserts value is SecurityEventType {
  if (!SECURITY_EVENT_TYPES.includes(value as SecurityEventType)) {
    throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 보안 이벤트입니다.");
  }
}

export function getAdminSetupReadiness() {
  const username = normalizeUsername(process.env.ADMIN_SETUP_USERNAME || "");
  const password = process.env.ADMIN_SETUP_PASSWORD || "";
  return { ready: /^[a-z0-9_]{4,24}$/.test(username) && password.length >= 4 };
}

export async function ensureInitialAdmin() {
  const setup = getAdminSetupReadiness();
  if (!setup.ready) throw new MemberAuthError("SETUP_ERROR", "초기 관리자 계정 설정이 올바르지 않습니다.");

  const username = normalizeUsername(process.env.ADMIN_SETUP_USERNAME || "");
  const db = getPool();
  const [existingRows] = await db.query("SELECT id FROM member_accounts WHERE username = ? LIMIT 1", [username]);
  if (Array.isArray(existingRows) && existingRows.length > 0) return;

  const id = randomUUID();
  await db.execute(
    `INSERT INTO member_accounts
      (id, username, password_hash, nickname, discord_nickname, game_nickname, role, status, approved_at, approved_by)
     VALUES (?, ?, ?, '관리자', '관리자', '관리자', 'admin', 'approved', NOW(), ?)`,
    [id, username, await hashPassword(process.env.ADMIN_SETUP_PASSWORD || ""), id],
  );
}

export async function registerMember(input: RegisterInput): Promise<PublicMember> {
  const normalized = assertRegistrationInput(input);
  const db = getPool();
  const [existingRows] = await db.query("SELECT id FROM member_accounts WHERE username = ? LIMIT 1", [normalized.username]);
  if (Array.isArray(existingRows) && existingRows.length > 0) {
    throw new MemberAuthError("DUPLICATE_USERNAME", "이미 사용 중인 아이디입니다.");
  }

  const id = randomUUID();
  await db.execute(
    `INSERT INTO member_accounts
      (id, username, password_hash, nickname, discord_nickname, game_nickname, role, status)
     VALUES (?, ?, ?, ?, ?, ?, 'member', 'pending')`,
    [id, normalized.username, await hashPassword(input.password), normalized.nickname, normalized.discordNickname, normalized.gameNickname],
  );
  const member = await findMemberById(id);
  if (!member) throw new MemberAuthError("SETUP_ERROR", "가입한 회원 정보를 확인할 수 없습니다.");
  return member;
}

async function findMemberRecordByUsername(username: string): Promise<MemberRecord | null> {
  const [rows] = await getPool().query(
    `SELECT id, username, password_hash AS passwordHash, nickname, discord_nickname AS discordNickname,
            game_nickname AS gameNickname, role, status, approved_at AS approvedAt, last_activity_at AS lastActivityAt, created_at AS createdAt
     FROM member_accounts WHERE username = ? LIMIT 1`,
    [normalizeUsername(username)],
  );
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  return row ? toMemberRecord(row) : null;
}

export async function findMemberById(id: string): Promise<PublicMember | null> {
  const [rows] = await getPool().query(
    `SELECT id, username, nickname, discord_nickname AS discordNickname, game_nickname AS gameNickname,
            role, status, approved_at AS approvedAt, last_activity_at AS lastActivityAt, created_at AS createdAt
     FROM member_accounts WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  return row ? toPublicMember(row) : null;
}

export async function loginMember(username: string, password: string, clientIp?: unknown) {
  await assertLoginNotLocked(username);
  const member = await findMemberRecordByUsername(username);
  if (!member || !(await verifyPassword(password, member.passwordHash))) {
    await recordLoginFailure(username);
    throw new MemberAuthError("INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  await clearLoginFailures(username);
  if (member.status === "pending") throw new MemberAuthError("PENDING_APPROVAL", "관리자 승인 대기 중인 계정입니다.");
  if (member.status === "suspended") throw new MemberAuthError("SUSPENDED", "이용이 정지된 계정입니다.");
  const session = await createSession(member);
  await markMemberActive(member.id, clientIp);
  return session;
}

/** 로그인 전 재설정 화면에서 아이디와 기존 비밀번호가 모두 맞는 경우에만 해당 계정의 비밀번호를 변경합니다. */
export async function changeMemberPasswordByCredentials(input: { username: unknown; currentPassword: unknown; newPassword: unknown }): Promise<PublicMember> {
  const username = normalizeUsername(typeof input.username === "string" ? input.username : "");
  assertPasswordValue(input.currentPassword, "기존 비밀번호");
  assertPasswordValue(input.newPassword, "새 비밀번호");
  if (!/^[a-z0-9_]{4,24}$/.test(username)) throw new MemberAuthError("INVALID_INPUT", "아이디를 올바르게 입력해 주세요.");

  await assertLoginNotLocked(username);
  const member = await findMemberRecordByUsername(username);
  if (!member || !(await verifyPassword(input.currentPassword, member.passwordHash))) {
    await recordLoginFailure(username);
    throw new MemberAuthError("INVALID_CREDENTIALS", "아이디 또는 기존 비밀번호가 올바르지 않습니다.");
  }

  await clearLoginFailures(username);
  const db = getPool();
  await db.execute("UPDATE member_accounts SET password_hash = ? WHERE id = ?", [await hashPassword(input.newPassword), member.id]);
  await db.execute("DELETE FROM member_sessions WHERE member_id = ?", [member.id]);
  const updatedMember = await findMemberById(member.id);
  if (!updatedMember) throw new MemberAuthError("SETUP_ERROR", "변경한 회원 정보를 확인할 수 없습니다.");
  return updatedMember;
}

/** 관리자용 초기화는 일반 회원만 대상으로 하며, 기존 로그인 세션을 모두 폐기합니다. */
export async function resetMemberPasswordByAdministrator(memberId: string, administratorId: string): Promise<PublicMember> {
  if (memberId === administratorId) throw new MemberAuthError("FORBIDDEN", "현재 로그인한 관리자 계정은 이 기능으로 초기화할 수 없습니다.");
  const member = await findMemberById(memberId);
  if (!member) throw new MemberAuthError("INVALID_INPUT", "회원을 찾을 수 없습니다.");
  if (member.role === "admin") throw new MemberAuthError("FORBIDDEN", "관리자 계정은 이 기능으로 초기화할 수 없습니다.");

  const db = getPool();
  await db.execute("UPDATE member_accounts SET password_hash = ? WHERE id = ?", [await hashPassword("1234"), member.id]);
  await db.execute("DELETE FROM member_sessions WHERE member_id = ?", [member.id]);
  await db.execute("DELETE FROM member_login_attempts WHERE attempt_key = ?", [loginAttemptKey(member.username)]);
  const updatedMember = await findMemberById(member.id);
  if (!updatedMember) throw new MemberAuthError("SETUP_ERROR", "초기화한 회원 정보를 확인할 수 없습니다.");
  return updatedMember;
}

export async function createSession(member: PublicMember) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  await getPool().execute("INSERT INTO member_sessions (id, member_id, token_hash, expires_at) VALUES (?, ?, ?, ?)", [randomUUID(), member.id, tokenHash, expiresAt]);
  return { member, token, expiresAt };
}

export async function getMemberFromToken(token?: string): Promise<PublicMember | null> {
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [rows] = await getPool().query(
    `SELECT m.id, m.username, m.nickname, m.discord_nickname AS discordNickname, m.game_nickname AS gameNickname,
            m.role, m.status, m.approved_at AS approvedAt, m.last_activity_at AS lastActivityAt, m.created_at AS createdAt
     FROM member_sessions s INNER JOIN member_accounts m ON m.id = s.member_id
     WHERE s.token_hash = ? AND s.expires_at > NOW() LIMIT 1`,
    [tokenHash],
  );
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) return null;
  const member = toPublicMember(row);
  return member.status === "approved" ? member : null;
}

export async function revokeSession(token?: string) {
  if (!token) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await getPool().execute("DELETE FROM member_sessions WHERE token_hash = ?", [tokenHash]);
}

/** 로그아웃 직전을 마지막 접속 시각으로 남긴 뒤 해당 세션을 폐기합니다. */
export async function logoutMember(token?: string, clientIp?: unknown): Promise<PublicMember | null> {
  const member = await getMemberFromToken(token);
  if (member) await markMemberActive(member.id, clientIp);
  await revokeSession(token);
  return member;
}

export async function markMemberActive(memberId: string, clientIp?: unknown) {
  const ipAddress = normalizeClientIp(clientIp);
  if (!ipAddress) {
    await getPool().execute("UPDATE member_accounts SET last_activity_at = NOW() WHERE id = ? AND status = 'approved'", [memberId]);
    return;
  }
  await getPool().execute("UPDATE member_accounts SET last_activity_at = NOW(), last_ip_address = ? WHERE id = ? AND status = 'approved'", [ipAddress, memberId]);
  await getPool().execute(
    "INSERT INTO member_ip_access_logs (id, member_id, ip_address, first_seen_at, last_seen_at) VALUES (?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE last_seen_at = NOW()",
    [randomUUID(), memberId, ipAddress],
  );
}

export async function listMemberIpAccessLogs(memberId: string, limit = 20): Promise<MemberIpAccessLog[]> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const [rows] = await getPool().query(
    `SELECT id, member_id AS memberId, ip_address AS ipAddress, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt
     FROM member_ip_access_logs WHERE member_id = ? ORDER BY last_seen_at DESC LIMIT ?`,
    [memberId, safeLimit],
  );
  return Array.isArray(rows) ? rows.map((row) => toMemberIpAccessLog(row as Record<string, unknown>)) : [];
}

export async function recordSecurityEvent(member: PublicMember, input: { eventType: unknown; path: unknown }): Promise<SecurityEvent> {
  assertSecurityEventType(input.eventType);
  const event: SecurityEvent = {
    id: randomUUID(),
    memberId: member.id,
    memberUsername: member.username,
    memberNickname: member.nickname,
    eventType: input.eventType,
    path: normalizeSecurityEventPath(input.path),
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
  await getPool().execute(
    `INSERT INTO security_events
      (id, member_id, member_username, member_nickname, event_type, path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [event.id, event.memberId, event.memberUsername, event.memberNickname, event.eventType, event.path],
  );
  return event;
}

export async function listSecurityEvents(limit = 100): Promise<SecurityEvent[]> {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  const [rows] = await getPool().query(
    `SELECT id, member_id AS memberId, member_username AS memberUsername, member_nickname AS memberNickname,
            event_type AS eventType, path, created_at AS createdAt, acknowledged_at AS acknowledgedAt,
            acknowledged_by AS acknowledgedBy
     FROM security_events
     ORDER BY created_at DESC
     LIMIT ?`,
    [safeLimit],
  );
  return Array.isArray(rows) ? rows.map((row) => toSecurityEvent(row as Record<string, unknown>)) : [];
}

export async function acknowledgeSecurityEvent(eventId: string, administratorId: string): Promise<SecurityEvent> {
  const [result] = await getPool().execute(
    "UPDATE security_events SET acknowledged_at = COALESCE(acknowledged_at, NOW()), acknowledged_by = COALESCE(acknowledged_by, ?) WHERE id = ?",
    [administratorId, eventId],
  );
  if (!result || typeof result !== "object" || !("affectedRows" in result) || Number((result as { affectedRows?: unknown }).affectedRows) === 0) {
    throw new MemberAuthError("INVALID_INPUT", "보안 이벤트를 찾을 수 없습니다.");
  }
  const [rows] = await getPool().query(
    `SELECT id, member_id AS memberId, member_username AS memberUsername, member_nickname AS memberNickname,
            event_type AS eventType, path, created_at AS createdAt, acknowledged_at AS acknowledgedAt,
            acknowledged_by AS acknowledgedBy
     FROM security_events WHERE id = ? LIMIT 1`,
    [eventId],
  );
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) throw new MemberAuthError("INVALID_INPUT", "보안 이벤트를 찾을 수 없습니다.");
  return toSecurityEvent(row);
}

export async function listMembers(): Promise<PublicMember[]> {
  const [rows] = await getPool().query(
    `SELECT id, username, nickname, discord_nickname AS discordNickname, game_nickname AS gameNickname,
            role, status, approved_at AS approvedAt, last_activity_at AS lastActivityAt, last_ip_address AS lastIpAddress, created_at AS createdAt
     FROM member_accounts ORDER BY FIELD(status, 'pending', 'suspended', 'approved'), created_at DESC`,
  );
  return Array.isArray(rows) ? rows.map((row) => toPublicMember(row as Record<string, unknown>)) : [];
}

export async function listActiveMembers(): Promise<PublicMember[]> {
  const [rows] = await getPool().query(
    `SELECT id, username, nickname, discord_nickname AS discordNickname, game_nickname AS gameNickname,
            role, status, approved_at AS approvedAt, last_activity_at AS lastActivityAt, created_at AS createdAt
     FROM member_accounts
     WHERE status = 'approved' AND last_activity_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
     ORDER BY last_activity_at DESC`,
    [ACTIVE_MEMBER_WINDOW_SECONDS],
  );
  return Array.isArray(rows) ? rows.map((row) => toPublicMember(row as Record<string, unknown>)) : [];
}

export async function changeMemberStatus(memberId: string, status: MemberStatus, approvedBy: string): Promise<PublicMember> {
  if (status === "approved") {
    await getPool().execute("UPDATE member_accounts SET status = ?, approved_at = NOW(), approved_by = ? WHERE id = ?", [status, approvedBy, memberId]);
  } else {
    await getPool().execute("UPDATE member_accounts SET status = ?, approved_at = NULL, approved_by = NULL, last_activity_at = NULL WHERE id = ?", [status, memberId]);
    await getPool().execute("DELETE FROM member_sessions WHERE member_id = ?", [memberId]);
    await getPool().execute("UPDATE member_device_push_tokens SET enabled = 0 WHERE member_id = ?", [memberId]);
  }
  const member = await findMemberById(memberId);
  if (!member) throw new MemberAuthError("INVALID_INPUT", "회원을 찾을 수 없습니다.");
  return member;
}

export async function deleteMember(memberId: string, administratorId: string) {
  if (memberId === administratorId) throw new MemberAuthError("FORBIDDEN", "현재 로그인한 관리자 계정은 탈퇴 처리할 수 없습니다.");
  const member = await findMemberById(memberId);
  if (!member) throw new MemberAuthError("INVALID_INPUT", "회원을 찾을 수 없습니다.");
  if (member.role === "admin") throw new MemberAuthError("FORBIDDEN", "관리자 계정은 탈퇴 처리할 수 없습니다.");

  const db = getPool();
  await db.execute("DELETE FROM member_sessions WHERE member_id = ?", [memberId]);
  await db.execute("DELETE FROM member_login_attempts WHERE attempt_key = ?", [loginAttemptKey(member.username)]);
  await db.execute("DELETE FROM member_ip_access_logs WHERE member_id = ?", [memberId]);
  await db.execute("DELETE FROM member_device_push_tokens WHERE member_id = ?", [memberId]);
  await db.execute("DELETE FROM member_accounts WHERE id = ?", [memberId]);
  return member;
}

export function sessionCookieHeader(token: string) {
  // Max-Age와 Expires를 의도적으로 지정하지 않아 브라우저 종료 시 세션이 사라진다.
  // 같은 브라우저 실행 중의 페이지 이동은 유지하면서, 새 접속은 다시 로그인해야 한다.
  return `${MEMBER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookieHeader() {
  return `${MEMBER_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function getCookieValue(cookieHeader: string | undefined, name: string) {
  return cookieHeader?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function getSessionTokenFromHeader(cookieHeader?: string, authorizationHeader?: string | string[]) {
  const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  const bearerToken = typeof authorization === "string"
    ? authorization.match(/^Bearer\s+([A-Za-z0-9_-]{32,128})$/i)?.[1]
    : undefined;
  return bearerToken || getCookieValue(cookieHeader, MEMBER_SESSION_COOKIE);
}
