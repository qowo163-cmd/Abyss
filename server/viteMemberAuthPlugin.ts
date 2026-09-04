import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import {
  MemberAuthError,
  changeMemberPasswordByCredentials,
  changeMemberStatus,
  clearSessionCookieHeader,
  deleteMember,
  ensureInitialAdmin,
  getAdminSetupReadiness,
  getMemberFromToken,
  getSessionTokenFromHeader,
  listActiveMembers,
  listMemberIpAccessLogs,
  listMembers,
  loginMember,
  logoutMember,
  markMemberActive,
  normalizeClientIp,
  registerMember,
  resetMemberPasswordByAdministrator,
  saveMemberExpoPushToken,
  sessionCookieHeader,
} from "./memberAuth";

function sendJson(res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) reject(new Error("PAYLOAD_TOO_LARGE"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

function memberAuthErrorPayload(error: unknown) {
  if (error instanceof MemberAuthError) {
    const statusByCode: Record<MemberAuthError["code"], number> = {
      INVALID_INPUT: 400,
      DUPLICATE_USERNAME: 409,
      INVALID_CREDENTIALS: 401,
      PENDING_APPROVAL: 403,
      SUSPENDED: 403,
      LOGIN_RATE_LIMITED: 429,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      SETUP_ERROR: 500,
    };
    return { status: statusByCode[error.code], payload: { error: error.code, message: error.message } };
  }
  return { status: 500, payload: { error: "AUTH_ERROR", message: "인증 처리 중 오류가 발생했습니다." } };
}

function requestClientIp(req: import("node:http").IncomingMessage) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwardedIp = typeof forwardedValue === "string" ? forwardedValue.split(",")[0] : undefined;
  return normalizeClientIp(firstForwardedIp) || normalizeClientIp(req.socket.remoteAddress);
}

export function vitePluginMemberAuth(): Plugin {
  return {
    name: "mixmaster-member-auth",
    configureServer(server: ViteDevServer) {
      void ensureInitialAdmin().catch((error) => console.error("Failed to initialize administrator account:", error));

      server.middlewares.use("/api/auth", async (req, res, next) => {
        const pathName = (req.url || "/").split("?")[0];
        try {
          if (req.method === "GET" && pathName === "/setup-ready") {
            sendJson(res, 200, getAdminSetupReadiness());
            return;
          }
          if (req.method === "GET" && pathName === "/session") {
            const member = await getMemberFromToken(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization));
            if (member) await markMemberActive(member.id, requestClientIp(req));
            sendJson(res, 200, { member }, { "Cache-Control": "no-store" });
            return;
          }
          if (req.method === "POST" && pathName === "/register") {
            const member = await registerMember((await readJsonBody(req)) as never);
            sendJson(res, 201, { member, message: "회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다." });
            return;
          }
          if (req.method === "POST" && pathName === "/login") {
            const input = (await readJsonBody(req)) as { username?: string; password?: string };
            const { member, token, expiresAt } = await loginMember(String(input.username || ""), String(input.password || ""), requestClientIp(req));
            const isNativeMobile = req.headers["x-abyss-client"] === "mobile-v2";
            sendJson(res, 200, isNativeMobile ? { member, sessionToken: token, expiresAt: expiresAt.toISOString() } : { member }, { "Set-Cookie": sessionCookieHeader(token) });
            return;
          }
          if (req.method === "POST" && pathName === "/password/change") {
            const input = (await readJsonBody(req)) as { username?: unknown; currentPassword?: unknown; newPassword?: unknown };
            const member = await changeMemberPasswordByCredentials({ username: input.username, currentPassword: input.currentPassword, newPassword: input.newPassword });
            sendJson(res, 200, { member, message: `${member.username} 계정의 비밀번호를 변경했습니다. 다시 로그인해 주세요.` });
            return;
          }
          if (req.method === "POST" && pathName === "/logout") {
            await logoutMember(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization), requestClientIp(req));
            sendJson(res, 200, { success: true }, { "Set-Cookie": clearSessionCookieHeader() });
            return;
          }

          const member = await getMemberFromToken(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization));
          if (!member) {
            sendJson(res, 401, { error: "UNAUTHORIZED", message: "승인된 회원 로그인이 필요합니다." });
            return;
          }
          if (req.method === "POST" && pathName === "/heartbeat") {
            await markMemberActive(member.id, requestClientIp(req));
            sendJson(res, 200, { success: true }, { "Cache-Control": "no-store" });
            return;
          }
          if (req.method === "GET" && pathName === "/online-count") {
            const members = await listActiveMembers();
            sendJson(res, 200, { count: members.length }, { "Cache-Control": "no-store" });
            return;
          }
          if (member.role !== "admin") {
            sendJson(res, member ? 403 : 401, { error: member ? "FORBIDDEN" : "UNAUTHORIZED", message: "관리자 권한이 필요합니다." });
            return;
          }
          if (req.method === "GET" && pathName === "/members") {
            sendJson(res, 200, await listMembers());
            return;
          }
          if (req.method === "GET" && pathName === "/members/active") {
            const members = await listActiveMembers();
            sendJson(res, 200, { count: members.length, members }, { "Cache-Control": "no-store" });
            return;
          }
          const ipHistoryMemberMatch = pathName.match(/^\/members\/([^/]+)\/ip-history$/);
          if (req.method === "GET" && ipHistoryMemberMatch) {
            sendJson(res, 200, { logs: await listMemberIpAccessLogs(ipHistoryMemberMatch[1]) }, { "Cache-Control": "no-store" });
            return;
          }
          const resetPasswordMemberMatch = pathName.match(/^\/members\/([^/]+)\/password\/reset$/);
          if (req.method === "PATCH" && resetPasswordMemberMatch) {
            const updated = await resetMemberPasswordByAdministrator(resetPasswordMemberMatch[1], member.id);
            sendJson(res, 200, { member: updated, message: `${updated.username} 계정의 비밀번호를 1234로 초기화했습니다.` });
            return;
          }
          const memberMatch = pathName.match(/^\/members\/([^/]+)\/status$/);
          if (req.method === "PATCH" && memberMatch) {
            const input = (await readJsonBody(req)) as { status?: "pending" | "approved" | "suspended" };
            if (input.status !== "pending" && input.status !== "approved" && input.status !== "suspended") {
              sendJson(res, 400, { error: "INVALID_INPUT", message: "올바른 회원 상태가 아닙니다." });
              return;
            }
            sendJson(res, 200, { member: await changeMemberStatus(memberMatch[1], input.status, member.id) });
            return;
          }
          const deleteMemberMatch = pathName.match(/^\/members\/([^/]+)$/);
          if (req.method === "DELETE" && deleteMemberMatch) {
            const deleted = await deleteMember(deleteMemberMatch[1], member.id);
            sendJson(res, 200, { member: deleted, message: `${deleted.username} 계정을 탈퇴 처리했습니다.` });
            return;
          }
          next();
        } catch (error) {
          const response = memberAuthErrorPayload(error);
          sendJson(res, response.status, response.payload);
        }
      });

      server.middlewares.use("/api", async (req, res, next) => {
        try {
          const member = await getMemberFromToken(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization));
          if (!member) {
            sendJson(res, 401, { error: "UNAUTHORIZED", message: "승인된 회원 로그인이 필요합니다." });
            return;
          }
          const pathName = (req.url || "/").split("?")[0];
          const adminMutation =
            (req.method === "POST" && (pathName === "/monsters" || pathName === "/monster-image" || pathName.startsWith("/updates"))) ||
            (req.method === "PATCH" && pathName.startsWith("/feedbacks/"));
          if (adminMutation && member.role !== "admin") {
            sendJson(res, 403, { error: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
            return;
          }
          if (req.method === "PUT" && pathName === "/mobile/push-token") {
            const input = (await readJsonBody(req)) as { token?: unknown; enabled?: unknown; platform?: unknown };
            await saveMemberExpoPushToken(member.id, input.token, input.enabled !== false, input.platform);
            res.writeHead(204);
            res.end();
            return;
          }
          next();
        } catch (error) {
          const response = memberAuthErrorPayload(error);
          sendJson(res, response.status, response.payload);
        }
      });
    },
  };
}
