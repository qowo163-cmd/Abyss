import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createHash } from "crypto";
import { storagePut } from "./storage.js";
import { loadMonsterData, mergeMonsterMetadata, saveMonsterData } from "./monsterDataStore.js";
import { normalizeStoredMonsterImageUrls, protectMonsterImageUrls } from "./monsterImageUrls.js";
import { PROTECTED_MONSTER_IMAGE_HEADERS, readProtectedMonsterImage } from "./protectedMonsterImage.js";
import {
  cancelMarketplaceBuyOrder,
  cancelMarketplaceListing,
  cancelMarketplaceSaleOffer,
  cancelMarketplaceTradeRequest,
  completeMarketplaceBuyOrder,
  completeMarketplaceTrade,
  createMarketplaceBuyOrder,
  createMarketplaceListing,
  createMarketplaceSaleOffer,
  createMarketplaceTradeRequest,
  getMarketplacePriceSummaries,
  listMarketplaceBuyOrders,
  listMarketplaceListings,
  listMyMarketplaceBuyOrders,
  listMyMarketplaceListings,
  listMyMarketplaceSaleOffers,
  listMyMarketplaceTradeRequests,
  respondToMarketplaceSaleOffer,
  respondToMarketplaceTradeRequest,
  syncMarketplaceMonsterSnapshot,
} from "./marketplace.js";
import { cancelExchangeListing, createExchangeListing, createExchangeOffer, getMyExchangeMarketplace, listExchangeListings, respondExchangeOffer, syncExchangeMonsterSnapshot } from "./exchangeMarketplace.js";
import { cancelItemListing, createItemListing, createItemRequest, getItemPriceSummaries, getMyItemMarketplace, listItemCatalog, listItemListings, respondItemRequest, saveItemCatalogEntry } from "./itemMarketplace.js";
import { assertMarketplaceTabAccess } from "./marketplaceAccess.js";
import { listMarketplaceHistory } from "./marketplaceHistory.js";
import { getMarketplaceTabSettings, saveMarketplaceTabSettings, type MarketplaceTab } from "./marketplaceSettings.js";
import { acknowledgeMarketplacePriceAlert, listMarketplacePriceAlerts, listMarketplacePriceResetLines, resetMarketplacePriceLine } from "./marketplacePriceProtection.js";
import { createMarketplaceRequestAlert, type MarketplaceRequestAlert } from "../shared/marketplaceRequestAlerts.js";
import {
  MEMBER_SESSION_COOKIE,
  MemberAuthError,
  acknowledgeSecurityEvent,
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
  listMemberExpoPushTokens,
  listMembers,
  listSecurityEvents,
  loginMember,
  logoutMember,
  markMemberActive,
  normalizeClientIp,
  recordSecurityEvent,
  registerMember,
  resetMemberPasswordByAdministrator,
  revokeSession,
  saveMemberExpoPushToken,
  sessionCookieHeader,
  type PublicMember,
} from "./memberAuth.js";
import { sendMarketplaceRequestPushAlert } from "./marketplacePushNotifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONSTERS_FILE_PATH = path.resolve(__dirname, "..", "client", "src", "data", "monsters.json");
const UPDATES_FILE_PATH = path.resolve(__dirname, "..", "client", "src", "data", "updates.json");
const FEEDBACKS_FILE_PATH = path.resolve(__dirname, "..", "client", "src", "data", "feedbacks.json");
const MAX_OPTIMIZED_IMAGE_BYTES = 6 * 1024 * 1024;
const updateSubscribers = new Set<import("http").ServerResponse>();
const feedbackSubscribers = new Set<import("http").ServerResponse>();
const monsterSubscribers = new Set<import("http").ServerResponse>();
const securityEventSubscribers = new Set<import("http").ServerResponse>();
const marketplaceSubscribers = new Map<import("http").ServerResponse, string>();
const recentSecurityEvents = new Map<string, number>();
const SECURITY_EVENT_DEDUPLICATION_MS = 30_000;

type RequestWithMember = import("express").Request & { member?: PublicMember };

type MonsterSnapshotSource = Record<string, unknown>;

function snapshotOf(monster: MonsterSnapshotSource) {
  return {
    id: String(monster.id || ""),
    name: String(monster.name || ""),
    attribute: monster.attribute ? String(monster.attribute) : null,
    type: monster.type ? String(monster.type) : null,
    level: monster.level ? String(monster.level) : null,
  };
}

function snapshotChanged(before: MonsterSnapshotSource | undefined, after: MonsterSnapshotSource) {
  if (!before) return true;
  const previous = snapshotOf(before);
  const next = snapshotOf(after);
  return previous.id !== next.id || previous.name !== next.name || previous.attribute !== next.attribute || previous.type !== next.type || previous.level !== next.level;
}

async function syncMarketplaceMonsterSnapshots(before: MonsterSnapshotSource[], after: MonsterSnapshotSource[]) {
  const previousById = new Map(before.map((monster) => [String(monster.id || ""), monster]));
  const changed = after.filter((monster) => snapshotChanged(previousById.get(String(monster.id || "")), monster));
  await Promise.all(changed.flatMap((monster) => {
    const snapshot = snapshotOf(monster);
    return [syncMarketplaceMonsterSnapshot(snapshot), syncExchangeMonsterSnapshot(snapshot)];
  }));
}

function requestClientIp(req: RequestWithMember) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwardedIp = typeof forwardedValue === "string" ? forwardedValue.split(",")[0] : undefined;
  return normalizeClientIp(firstForwardedIp) || normalizeClientIp(req.socket.remoteAddress);
}

function respondMemberAuthError(res: import("express").Response, error: unknown) {
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
    res.status(statusByCode[error.code]).json({ error: error.code, message: error.message });
    return;
  }
  console.error("Member authentication error:", error);
  res.status(500).json({ error: "AUTH_ERROR", message: "인증 처리 중 오류가 발생했습니다." });
}

async function requireApprovedMember(req: RequestWithMember, res: import("express").Response, next: import("express").NextFunction) {
  try {
    const member = await getMemberFromToken(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization));
    if (!member) {
      if (req.originalUrl.startsWith("/api/")) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "승인된 회원 로그인이 필요합니다." });
      } else {
        res.redirect("/login");
      }
      return;
    }
    req.member = member;
    next();
  } catch (error) {
    respondMemberAuthError(res, error);
  }
}

function requireAdministrator(req: RequestWithMember, res: import("express").Response, next: import("express").NextFunction) {
  if (req.member?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
    return;
  }
  next();
}

function requireMarketplaceTab(tab: MarketplaceTab) {
  return async (req: RequestWithMember, res: import("express").Response, next: import("express").NextFunction) => {
    try {
      await assertMarketplaceTabAccess(req.member!, tab);
      next();
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  };
}

function readUpdatesFile(): unknown[] {
  try {
    if (!fs.existsSync(UPDATES_FILE_PATH)) return [];
    const value = JSON.parse(fs.readFileSync(UPDATES_FILE_PATH, "utf-8"));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Failed to read updates:", error);
    return [];
  }
}

function broadcastUpdates(updates: unknown[]) {
  const payload = `event: updates\nid: ${Date.now()}\ndata: ${JSON.stringify(updates)}\n\n`;
  updateSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      updateSubscribers.delete(subscriber);
    }
  });
}

function saveUpdatesFile(updates: unknown[]) {
  fs.writeFileSync(UPDATES_FILE_PATH, JSON.stringify(updates, null, 2), "utf-8");
  broadcastUpdates(updates);
}

function readFeedbacksFile(): unknown[] {
  try {
    if (!fs.existsSync(FEEDBACKS_FILE_PATH)) return [];
    const value = JSON.parse(fs.readFileSync(FEEDBACKS_FILE_PATH, "utf-8"));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Failed to read feedbacks:", error);
    return [];
  }
}

function broadcastFeedbacks(feedbacks: unknown[]) {
  const payload = `event: feedbacks\nid: ${Date.now()}\ndata: ${JSON.stringify(feedbacks)}\n\n`;
  feedbackSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      feedbackSubscribers.delete(subscriber);
    }
  });
}

function saveFeedbacksFile(feedbacks: unknown[]) {
  fs.writeFileSync(FEEDBACKS_FILE_PATH, JSON.stringify(feedbacks, null, 2), "utf-8");
  broadcastFeedbacks(feedbacks);
}

function broadcastMonsters(monsters: unknown[]) {
  const payload = `event: monsters\nid: ${Date.now()}\ndata: ${JSON.stringify(protectMonsterImageUrls(monsters))}\n\n`;
  monsterSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      monsterSubscribers.delete(subscriber);
    }
  });
}

function broadcastSecurityEvent(event: unknown) {
  const payload = `event: security-event\nid: ${Date.now()}\ndata: ${JSON.stringify(event)}\n\n`;
  securityEventSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      securityEventSubscribers.delete(subscriber);
    }
  });
}

function broadcastMarketplace(requestAlert?: MarketplaceRequestAlert) {
  const changedAt = Date.now();
  const payload = `event: marketplace\nid: ${changedAt}\ndata: {"changedAt":${changedAt}}\n\n`;
  marketplaceSubscribers.forEach((memberId, subscriber) => {
    try {
      subscriber.write(payload);
      if (requestAlert && memberId === requestAlert.recipientMemberId) {
        subscriber.write(`event: marketplace-request\nid: ${requestAlert.id}\ndata: ${JSON.stringify(requestAlert)}\n\n`);
      }
    } catch {
      marketplaceSubscribers.delete(subscriber);
    }
  });
  if (requestAlert) {
    void sendMarketplaceRequestPushAlert(requestAlert).catch((error) => {
      console.error("Failed to send marketplace device push notification:", error);
    });
  }
}

function canRecordSecurityEvent(memberId: string, eventType: unknown) {
  const key = `${memberId}:${String(eventType)}`;
  const now = Date.now();
  const previous = recentSecurityEvents.get(key) || 0;
  if (now - previous < SECURITY_EVENT_DEDUPLICATION_MS) return false;
  recentSecurityEvents.set(key, now);
  if (recentSecurityEvents.size > 2_000) {
    recentSecurityEvents.forEach((timestamp, candidate) => {
      if (now - timestamp > SECURITY_EVENT_DEDUPLICATION_MS) recentSecurityEvents.delete(candidate);
    });
  }
  return true;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));

  // Keep stored image responses from being cached or receiving page referrers.
  // The storage platform still serves the bytes; this middleware only adds
  // conservative response headers when the request passes through Express.
  app.use("/manus-storage", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  // 몬스터 이미지는 반드시 승인 회원용 프록시를 거쳐야 하며 원본 저장 경로는 직접 제공하지 않습니다.
  app.use("/manus-storage/monster-images", (_req, res) => {
    res.status(404).end();
  });

  // Android 앱 배포 종료 후, 이전 북마크와 최신 다운로드 주소도 설치 파일을 제공하지 않습니다.
  app.get("/download/android/latest", (_req, res) => {
    res.status(410).json({ error: "ANDROID_APP_RETIRED", message: "Android 앱 배포가 종료되었습니다." });
  });

  await ensureInitialAdmin();

  app.get("/api/auth/setup-ready", (_req, res) => {
    res.json(getAdminSetupReadiness());
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const member = await getMemberFromToken(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization));
      if (member) await markMemberActive(member.id, requestClientIp(req));
      res.setHeader("Cache-Control", "no-store");
      res.json({ member });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const member = await registerMember(req.body || {});
      res.status(201).json({ member, message: "회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다." });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { member, token, expiresAt } = await loginMember(String(req.body?.username || ""), String(req.body?.password || ""), requestClientIp(req));
      res.setHeader("Set-Cookie", sessionCookieHeader(token));
      const isNativeMobile = req.get("x-abyss-client") === "mobile-v2";
      res.json(isNativeMobile ? { member, sessionToken: token, expiresAt: expiresAt.toISOString() } : { member });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/auth/password/change", async (req, res) => {
    try {
      const member = await changeMemberPasswordByCredentials({
        username: req.body?.username,
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword,
      });
      res.json({ member, message: `${member.username} 계정의 비밀번호를 변경했습니다. 다시 로그인해 주세요.` });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const member = await logoutMember(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization), requestClientIp(req));
      res.setHeader("Set-Cookie", clearSessionCookieHeader());
      res.json({ success: true, lastActivityAt: member ? new Date().toISOString() : null });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/auth/heartbeat", requireApprovedMember, async (req: RequestWithMember, res) => {
    try {
      await markMemberActive(req.member!.id, requestClientIp(req));
      res.setHeader("Cache-Control", "no-store");
      res.json({ success: true });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/auth/online-count", requireApprovedMember, async (_req, res) => {
    try {
      const members = await listActiveMembers();
      res.setHeader("Cache-Control", "no-store");
      res.json({ count: members.length });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/auth/members", requireApprovedMember, requireAdministrator, async (_req, res) => {
    try {
      res.json(await listMembers());
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/auth/members/active", requireApprovedMember, requireAdministrator, async (_req, res) => {
    try {
      const members = await listActiveMembers();
      res.setHeader("Cache-Control", "no-store");
      res.json({ count: members.length, members });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/auth/members/:id/ip-history", requireApprovedMember, requireAdministrator, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ logs: await listMemberIpAccessLogs(req.params.id) });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/auth/members/:id/password/reset", requireApprovedMember, requireAdministrator, async (req: RequestWithMember, res) => {
    try {
      const member = await resetMemberPasswordByAdministrator(req.params.id, req.member!.id);
      res.json({ member, message: `${member.username} 계정의 비밀번호를 1234로 초기화했습니다.` });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/auth/members/:id/status", requireApprovedMember, requireAdministrator, async (req: RequestWithMember, res) => {
    const status = req.body?.status;
    if (status !== "approved" && status !== "pending" && status !== "suspended") {
      res.status(400).json({ error: "INVALID_INPUT", message: "올바른 회원 상태가 아닙니다." });
      return;
    }
    try {
      const member = await changeMemberStatus(req.params.id, status, req.member!.id);
      res.json({ member });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.delete("/api/auth/members/:id", requireApprovedMember, requireAdministrator, async (req: RequestWithMember, res) => {
    try {
      const member = await deleteMember(req.params.id, req.member!.id);
      res.json({ member, message: `${member.username} 계정을 탈퇴 처리했습니다.` });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.use("/api", requireApprovedMember);

  app.put("/api/mobile/push-token", async (req: RequestWithMember, res) => {
    try {
      const token = req.body?.token;
      const enabled = req.body?.enabled !== false;
      const platform = req.body?.platform;
      await saveMemberExpoPushToken(req.member!.id, token, enabled, platform);
      res.status(204).end();
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/admin/mobile/push-test", requireAdministrator, async (req: RequestWithMember, res) => {
    try {
      const registeredDevices = await listMemberExpoPushTokens(req.member!.id);
      if (registeredDevices.length === 0) {
        res.status(409).json({ success: false, reason: "no-registered-device" });
        return;
      }
      const alert = createMarketplaceRequestAlert({
        recipientMemberId: req.member!.id,
        kind: "hench-sell",
        actorName: "알림 테스트",
        targetName: "로엘",
        quantity: 1,
      });
      await sendMarketplaceRequestPushAlert(alert);
      res.json({ success: true, registeredDeviceCount: registeredDevices.length });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/marketplace/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    marketplaceSubscribers.set(res, (req as RequestWithMember).member!.id);
    res.write(`event: marketplace\ndata: {"connected":true}\n\n`);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      marketplaceSubscribers.delete(res);
    });
  });

  app.get("/api/marketplace/tab-settings", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ settings: await getMarketplaceTabSettings() });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/admin/marketplace/tab-settings", requireAdministrator, async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ settings: await getMarketplaceTabSettings() });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.put("/api/admin/marketplace/tab-settings", requireAdministrator, async (req: RequestWithMember, res) => {
    try {
      const settings = await saveMarketplaceTabSettings(req.member!.id, req.body || {});
      broadcastMarketplace();
      res.json({ settings });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/admin/marketplace/price-protection", requireAdministrator, async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ lines: listMarketplacePriceResetLines(), alerts: await listMarketplacePriceAlerts() });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.post("/api/admin/marketplace/price-protection/reset", requireAdministrator, async (req: RequestWithMember, res) => {
    try {
      const result = await resetMarketplacePriceLine(req.member!.id, req.body?.lineId);
      broadcastMarketplace();
      res.json({ result });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.patch("/api/admin/marketplace/price-alerts/:id/acknowledge", requireAdministrator, async (req: RequestWithMember, res) => {
    try { res.json({ alert: await acknowledgeMarketplacePriceAlert(req.member!.id, req.params.id) }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/listings", requireMarketplaceTab("sell"), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      res.setHeader("Cache-Control", "no-store");
      res.json({ listings: await listMarketplaceListings(query) });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/marketplace/exchanges", requireMarketplaceTab("exchange"), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      res.setHeader("Cache-Control", "no-store");
      res.json({ exchanges: await listExchangeListings(query) });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/exchanges/mine", async (req: RequestWithMember, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await getMyExchangeMarketplace(req.member!.id));
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/items", requireMarketplaceTab("items"), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      res.setHeader("Cache-Control", "no-store");
      res.json({ listings: await listItemListings(query, type) });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/items/mine", async (req: RequestWithMember, res) => {
    try { res.setHeader("Cache-Control", "no-store"); res.json(await getMyItemMarketplace(req.member!.id)); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/items/price-summaries", requireMarketplaceTab("items"), async (req, res) => {
    try { const names = typeof req.query.names === "string" ? req.query.names.split(",") : []; res.setHeader("Cache-Control", "no-store"); res.json({ prices: await getItemPriceSummaries(names) }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/admin/history", requireAdministrator, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ records: await listMarketplaceHistory(req.query) });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/admin/item-catalog", requireAdministrator, async (_req, res) => {
    try { res.setHeader("Cache-Control", "no-store"); res.json({ items: await listItemCatalog(true) }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.post("/api/admin/item-catalog", requireAdministrator, async (req: RequestWithMember, res) => {
    try { const item = await saveItemCatalogEntry(req.member!.id, req.body || {}); broadcastMarketplace(); res.status(201).json({ item }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.put("/api/admin/item-catalog/:id", requireAdministrator, async (req: RequestWithMember, res) => {
    try { const item = await saveItemCatalogEntry(req.member!.id, { ...(req.body || {}), id: req.params.id }); broadcastMarketplace(); res.json({ item }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.post("/api/marketplace/items", requireMarketplaceTab("items"), async (req: RequestWithMember, res) => {
    try {
      const listing = await createItemListing(req.member!, req.body || {});
      broadcastMarketplace();
      res.status(201).json({ listing });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.patch("/api/marketplace/items/:id/cancel", async (req: RequestWithMember, res) => {
    try { const listing = await cancelItemListing(req.member!.id, req.params.id); broadcastMarketplace(); res.json({ listing }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.post("/api/marketplace/items/:id/requests", requireMarketplaceTab("items"), async (req: RequestWithMember, res) => {
    try { const request = await createItemRequest(req.member!, req.params.id, req.body || {}); broadcastMarketplace(createMarketplaceRequestAlert({ recipientMemberId: request.ownerId, kind: "item", actorName: request.requesterGameNickname, targetName: request.itemName, quantity: request.requestedQuantity })); res.status(201).json({ request }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.patch("/api/marketplace/item-requests/:id", async (req: RequestWithMember, res) => {
    try {
      const action = req.body?.action;
      if (action !== "accept" && action !== "reject" && action !== "complete" && action !== "cancel") throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 아이템 거래 처리입니다.");
      const request = await respondItemRequest(req.member!.id, req.params.id, action);
      broadcastMarketplace();
      res.json({ request });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.post("/api/marketplace/exchanges", requireMarketplaceTab("exchange"), async (req: RequestWithMember, res) => {
    try {
      const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
      const snapshot = (id: unknown) => {
        const found = monsters.find((candidate) => String(candidate.id || "") === String(id || ""));
        if (!found) throw new MemberAuthError("INVALID_INPUT", "현재 헨치 데이터에서 선택한 헨치를 찾을 수 없습니다.");
        return { id: String(found.id || ""), name: String(found.name || ""), attribute: found.attribute ? String(found.attribute) : null, type: found.type ? String(found.type) : null, level: found.level ? String(found.level) : null };
      };
      const wants = Array.isArray(req.body?.wants) ? req.body.wants.map((want: Record<string, unknown>) => ({ monster: snapshot(want.monsterId), quantity: want.quantity })) : [];
      const listing = await createExchangeListing(req.member!, { offered: snapshot(req.body?.offeredMonsterId), offeredQuantity: req.body?.offeredQuantity, wants, note: req.body?.note });
      broadcastMarketplace(); res.status(201).json({ listing });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.post("/api/marketplace/exchanges/:id/offers", requireMarketplaceTab("exchange"), async (req: RequestWithMember, res) => {
    try {
      const found = (await loadMonsterData(MONSTERS_FILE_PATH)).find((candidate) => String(candidate.id || "") === String(req.body?.offeredMonsterId || ""));
      if (!found) throw new MemberAuthError("INVALID_INPUT", "제안할 헨치를 찾을 수 없습니다.");
      const offer = await createExchangeOffer(req.member!, req.params.id, { offered: { id: String(found.id || ""), name: String(found.name || ""), attribute: found.attribute ? String(found.attribute) : null, type: found.type ? String(found.type) : null, level: found.level ? String(found.level) : null }, quantity: req.body?.quantity, message: req.body?.message });
      broadcastMarketplace(createMarketplaceRequestAlert({ recipientMemberId: offer.ownerId, kind: "exchange", actorName: offer.proposerGameNickname, targetName: offer.offeredMonsterName, quantity: offer.offeredQuantity })); res.status(201).json({ offer });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.patch("/api/marketplace/exchanges/:id/cancel", async (req: RequestWithMember, res) => {
    try { const listing = await cancelExchangeListing(req.member!.id, req.params.id); broadcastMarketplace(); res.json({ listing }); }
    catch (error) { respondMemberAuthError(res, error); }
  });

  app.patch("/api/marketplace/exchange-offers/:id", async (req: RequestWithMember, res) => {
    try {
      const action = req.body?.action;
      if (action !== "accept" && action !== "reject" && action !== "complete" && action !== "cancel") throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 교환 처리입니다.");
      const offer = await respondExchangeOffer(req.member!.id, req.params.id, action);
      broadcastMarketplace(); res.json({ offer });
    } catch (error) { respondMemberAuthError(res, error); }
  });

  app.get("/api/marketplace/price-summaries", requireMarketplaceTab("sell"), async (req, res) => {
    try {
      const rawIds = typeof req.query.ids === "string" ? req.query.ids : "";
      const prices = await getMarketplacePriceSummaries(rawIds.split(","));
      res.setHeader("Cache-Control", "no-store");
      res.json({ prices });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/marketplace/mine", async (req: RequestWithMember, res) => {
    try {
      const [listings, requests, buyOrders, saleOffers] = await Promise.all([
        listMyMarketplaceListings(req.member!.id),
        listMyMarketplaceTradeRequests(req.member!.id),
        listMyMarketplaceBuyOrders(req.member!.id),
        listMyMarketplaceSaleOffers(req.member!.id),
      ]);
      res.setHeader("Cache-Control", "no-store");
      res.json({ listings, requests, buyOrders, saleOffers });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/marketplace/listings", requireMarketplaceTab("sell"), async (req: RequestWithMember, res) => {
    try {
      const monsterId = typeof req.body?.monsterId === "string" ? req.body.monsterId : "";
      const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
      const monster = monsters.find((candidate) => String(candidate.id || "") === monsterId);
      if (!monster) {
        res.status(400).json({ error: "INVALID_INPUT", message: "현재 헨치 데이터에서 등록할 헨치를 찾을 수 없습니다." });
        return;
      }
      const listing = await createMarketplaceListing(req.member!, {
        monster: {
          id: String(monster.id || ""),
          name: String(monster.name || ""),
          attribute: monster.attribute ? String(monster.attribute) : null,
          type: monster.type ? String(monster.type) : null,
          level: monster.level ? String(monster.level) : null,
        },
        quantity: req.body?.quantity,
        priceBoxes: req.body?.priceBoxes,
        unitPriceBoxes: req.body?.unitPriceBoxes,
        note: req.body?.note,
      });
      broadcastMarketplace();
      res.status(201).json({ listing });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/marketplace/listings/:id/cancel", async (req: RequestWithMember, res) => {
    try {
      const listing = await cancelMarketplaceListing(req.member!.id, req.params.id);
      broadcastMarketplace();
      res.json({ listing });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/marketplace/listings/:id/requests", requireMarketplaceTab("sell"), async (req: RequestWithMember, res) => {
    try {
      const request = await createMarketplaceTradeRequest(req.member!, req.params.id, { requestedQuantity: req.body?.quantity, message: req.body?.message });
      broadcastMarketplace(createMarketplaceRequestAlert({ recipientMemberId: request.sellerId, kind: "hench-sell", actorName: request.buyerGameNickname, targetName: request.listing.monster.name, quantity: request.requestedQuantity }));
      res.status(201).json({ request });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/marketplace/requests/:id", async (req: RequestWithMember, res) => {
    const action = req.body?.action;
    try {
      if (action === "accept" || action === "reject") {
        const request = await respondToMarketplaceTradeRequest(req.member!.id, req.params.id, action);
        broadcastMarketplace();
        res.json({ request });
        return;
      }
      if (action === "cancel") {
        const request = await cancelMarketplaceTradeRequest(req.member!.id, req.params.id);
        broadcastMarketplace();
        res.json({ request });
        return;
      }
      if (action === "complete") {
        const request = await completeMarketplaceTrade(req.member!.id, req.params.id);
        broadcastMarketplace();
        res.json({ request });
        return;
      }
      res.status(400).json({ error: "INVALID_INPUT", message: "지원하지 않는 거래 요청 처리입니다." });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/marketplace/buy-orders", requireMarketplaceTab("buy"), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      res.setHeader("Cache-Control", "no-store");
      res.json({ buyOrders: await listMarketplaceBuyOrders(query) });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/marketplace/buy-orders", requireMarketplaceTab("buy"), async (req: RequestWithMember, res) => {
    try {
      const monsterId = typeof req.body?.monsterId === "string" ? req.body.monsterId : "";
      const monster = (await loadMonsterData(MONSTERS_FILE_PATH)).find((candidate) => String(candidate.id || "") === monsterId);
      if (!monster) {
        res.status(400).json({ error: "INVALID_INPUT", message: "현재 헨치 데이터에서 구매할 헨치를 찾을 수 없습니다." });
        return;
      }
      const buyOrder = await createMarketplaceBuyOrder(req.member!, {
        monster: { id: String(monster.id || ""), name: String(monster.name || ""), attribute: monster.attribute ? String(monster.attribute) : null, type: monster.type ? String(monster.type) : null, level: monster.level ? String(monster.level) : null },
        quantity: req.body?.quantity, offerBoxes: req.body?.offerBoxes, unitOfferBoxes: req.body?.unitOfferBoxes, note: req.body?.note,
      });
      broadcastMarketplace();
      res.status(201).json({ buyOrder });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/marketplace/buy-orders/:id/cancel", async (req: RequestWithMember, res) => {
    try {
      const buyOrder = await cancelMarketplaceBuyOrder(req.member!.id, req.params.id);
      broadcastMarketplace();
      res.json({ buyOrder });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/marketplace/buy-orders/:id/sale-offers", requireMarketplaceTab("buy"), async (req: RequestWithMember, res) => {
    try {
      const offer = await createMarketplaceSaleOffer(req.member!, req.params.id, { offeredQuantity: req.body?.quantity, message: req.body?.message });
      broadcastMarketplace(createMarketplaceRequestAlert({ recipientMemberId: offer.buyerId, kind: "hench-buy", actorName: offer.sellerGameNickname, targetName: offer.buyOrder.monster.name, quantity: offer.offeredQuantity }));
      res.status(201).json({ offer });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/marketplace/sale-offers/:id", async (req: RequestWithMember, res) => {
    const action = req.body?.action;
    try {
      if (action === "accept" || action === "reject") {
        const offer = await respondToMarketplaceSaleOffer(req.member!.id, req.params.id, action);
        broadcastMarketplace();
        res.json({ offer });
        return;
      }
      if (action === "cancel") {
        const offer = await cancelMarketplaceSaleOffer(req.member!.id, req.params.id);
        broadcastMarketplace();
        res.json({ offer });
        return;
      }
      if (action === "complete") {
        const offer = await completeMarketplaceBuyOrder(req.member!.id, req.params.id);
        broadcastMarketplace();
        res.json({ offer });
        return;
      }
      res.status(400).json({ error: "INVALID_INPUT", message: "지원하지 않는 판매 제안 처리입니다." });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/monster-image", async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    if (!key) {
      res.status(400).json({ error: "Invalid image key" });
      return;
    }
    try {
      const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
      const image = await readProtectedMonsterImage(monsters, key);
      if (!image) {
        res.status(404).json({ error: "Image not found" });
        return;
      }
      res.set(PROTECTED_MONSTER_IMAGE_HEADERS);
      res.setHeader("Content-Type", image.contentType);
      res.setHeader("Content-Length", String(image.bytes.length));
      res.status(200).end(image.bytes);
    } catch (error) {
      console.error("Failed to create protected image URL:", error);
      res.status(502).json({ error: "Image unavailable" });
    }
  });

  app.get("/api/monsters", async (req, res) => {
    try {
      const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
      const data = JSON.stringify(monsters);
      const etag = `"${createHash("sha1").update(data).digest("hex")}"`;
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("ETag", etag);
      res.json(protectMonsterImageUrls(monsters));
    } catch (error) {
      console.error("Failed to read monsters:", error);
      res.status(500).json({ error: "Failed to read monsters" });
    }
  });

  app.get("/api/monsters/events", async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    monsterSubscribers.add(res);
    const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
    res.write(`event: monsters\ndata: ${JSON.stringify(protectMonsterImageUrls(monsters))}\n\n`);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      monsterSubscribers.delete(res);
    });
  });

  app.post("/api/monsters", requireAdministrator, async (req, res) => {
    try {
      const incoming = req.body;
      if (!Array.isArray(incoming)) {
        res.status(400).json({ error: "Invalid data format" });
        return;
      }
      const current = await loadMonsterData(MONSTERS_FILE_PATH);
      // 방어 로직: 만약 incoming 배열이 비어있고 기존 몬스터가 존재한다면 비정상 유실로 판단하여 기존 데이터를 유지
      if (incoming.length === 0 && current.length > 0) {
        console.warn("Rejected empty monster upload to prevent data loss. Keeping existing monsters.");
        res.status(400).json({ error: "EMPTY_IMPORT", message: "임포트된 데이터가 비어있어 기존 몬스터가 유실되는 것을 방지하기 위해 저장이 거부되었습니다." });
        return;
      }
      const normalizedIncoming = normalizeStoredMonsterImageUrls(incoming as Record<string, unknown>[]);
      const monsters = mergeMonsterMetadata(normalizedIncoming, current);
      await saveMonsterData(monsters, MONSTERS_FILE_PATH);
      await syncMarketplaceMonsterSnapshots(current, monsters);
      broadcastMonsters(monsters);
      res.json({ success: true, monsters: protectMonsterImageUrls(monsters) });
    } catch (error) {
      console.error("Failed to save monsters:", error);
      res.status(500).json({ error: "Failed to save monsters", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/updates/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    updateSubscribers.add(res);
    res.write(`event: updates\ndata: ${JSON.stringify(readUpdatesFile())}\n\n`);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      updateSubscribers.delete(res);
    });
  });

  app.get("/api/updates", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(readUpdatesFile());
  });

  app.post("/api/updates/append", requireAdministrator, (req, res) => {
    try {
      const update = req.body;
      if (!update || typeof update !== "object" || !update.id || !update.title) {
        res.status(400).json({ error: "Invalid update item" });
        return;
      }
      const byId = new Map(readUpdatesFile().map(item => [String((item as { id?: unknown }).id), item]));
      byId.set(String(update.id), update);
      const updates = Array.from(byId.values()).sort((a, b) => {
        const aDate = Date.parse(String((a as { date?: unknown }).date || "")) || 0;
        const bDate = Date.parse(String((b as { date?: unknown }).date || "")) || 0;
        return bDate - aDate;
      });
      saveUpdatesFile(updates);
      res.json({ success: true, updates });
    } catch (error) {
      console.error("Failed to append update:", error);
      res.status(500).json({ error: "Failed to append update" });
    }
  });

  app.post("/api/updates", requireAdministrator, (req, res) => {
    try {
      const updates = req.body;
      if (!Array.isArray(updates)) {
        res.status(400).json({ error: "Invalid update data" });
        return;
      }
      saveUpdatesFile(updates);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save updates:", error);
      res.status(500).json({ error: "Failed to save updates" });
    }
  });

  app.get("/api/feedbacks/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    feedbackSubscribers.add(res);
    res.write(`event: feedbacks\ndata: ${JSON.stringify(readFeedbacksFile())}\n\n`);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      feedbackSubscribers.delete(res);
    });
  });

  app.get("/api/feedbacks", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(readFeedbacksFile());
  });

  app.post("/api/security-events", async (req: RequestWithMember, res) => {
    try {
      const eventType = req.body?.eventType;
      if (!canRecordSecurityEvent(req.member!.id, eventType)) {
        res.status(202).json({ accepted: false, reason: "DEDUPLICATED" });
        return;
      }
      const event = await recordSecurityEvent(req.member!, { eventType, path: req.body?.path });
      broadcastSecurityEvent(event);
      res.status(201).json({ event });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/security-events", requireAdministrator, async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await listSecurityEvents());
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.get("/api/security-events/events", requireAdministrator, async (req, res) => {
    try {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      securityEventSubscribers.add(res);
      res.write(`event: security-events\ndata: ${JSON.stringify(await listSecurityEvents(30))}\n\n`);
      const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
      req.on("close", () => {
        clearInterval(heartbeat);
        securityEventSubscribers.delete(res);
      });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.patch("/api/security-events/:id/acknowledge", requireAdministrator, async (req: RequestWithMember, res) => {
    try {
      const event = await acknowledgeSecurityEvent(req.params.id, req.member!.id);
      broadcastSecurityEvent(event);
      res.json({ event });
    } catch (error) {
      respondMemberAuthError(res, error);
    }
  });

  app.post("/api/feedbacks", (req, res) => {
    try {
      const feedback = req.body;
      if (!feedback || typeof feedback !== "object" || !feedback.id || !feedback.title || !feedback.content) {
        res.status(400).json({ error: "Invalid feedback item" });
        return;
      }
      const feedbacks = [feedback, ...readFeedbacksFile().filter(item => String((item as { id?: unknown }).id) !== String(feedback.id))];
      saveFeedbacksFile(feedbacks);
      res.status(201).json({ success: true, feedbacks });
    } catch (error) {
      console.error("Failed to save feedback:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  app.patch("/api/feedbacks/:id", requireAdministrator, (req, res) => {
    try {
      const status = req.body?.status;
      if (status !== "pending" && status !== "reviewing" && status !== "completed") {
        res.status(400).json({ error: "Invalid feedback status" });
        return;
      }
      let found = false;
      const feedbacks = readFeedbacksFile().map(item => {
        if (String((item as { id?: unknown }).id) !== req.params.id) return item;
        found = true;
        return { ...(item as Record<string, unknown>), status };
      });
      if (!found) {
        res.status(404).json({ error: "Feedback not found" });
        return;
      }
      saveFeedbacksFile(feedbacks);
      res.json({ success: true, feedbacks });
    } catch (error) {
      console.error("Failed to update feedback status:", error);
      res.status(500).json({ error: "Failed to update feedback status" });
    }
  });

  app.post("/api/monster-image", requireAdministrator, async (req, res) => {
    try {
      const { monsterId, fileName, contentType, data } = req.body || {};
      if (!monsterId || !fileName || !contentType || typeof data !== "string") {
        res.status(400).json({ error: "Invalid image payload" });
        return;
      }
      if (contentType !== "image/webp" || !data.startsWith("data:image/webp;base64,")) {
        res.status(400).json({ error: "Optimized WebP image payload required" });
        return;
      }
      const base64 = data.replace(/^data:image\/webp;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length === 0 || buffer.length > MAX_OPTIMIZED_IMAGE_BYTES) {
        res.status(400).json({ error: "Optimized image must be between 1 byte and 6MB" });
        return;
      }
      const current = await loadMonsterData(MONSTERS_FILE_PATH);
      const monsterIndex = current.findIndex((monster) => String(monster.id || "") === String(monsterId));
      if (monsterIndex < 0) {
        res.status(404).json({ error: "Monster not found" });
        return;
      }
      const result = await storagePut(`monster-images/${monsterId}.webp`, buffer, "image/webp");
      // 동일한 저장 키를 재사용하더라도 버전 값을 바꿔 브라우저·CDN의 이전 이미지 캐시를 확실히 우회합니다.
      const imageVersion = Date.now();
      const updatedMonsters = current.map((monster, index) => index === monsterIndex
        ? { ...monster, imageUrl: result.url, imageVersion }
        : monster);
      await saveMonsterData(updatedMonsters, MONSTERS_FILE_PATH);
      await syncMarketplaceMonsterSnapshots(current, updatedMonsters);
      broadcastMonsters(updatedMonsters);
      const persistedMonster = protectMonsterImageUrls([updatedMonsters[monsterIndex]])[0];
      res.setHeader("Cache-Control", "no-store");
      res.json({ ...result, persisted: true, monster: persistedMonster });
    } catch (error) {
      console.error("Failed to upload monster image:", error);
      res.status(500).json({ error: "Failed to upload monster image" });
    }
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  const publicEntryPaths = ["/login", "/register", "/pending"];
  app.get(publicEntryPaths, (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
  app.use(express.static(staticPath));
  app.get("*", requireApprovedMember, (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
