import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { loadMonsterData } from "./monsterDataStore";
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
} from "./marketplace";
import { cancelExchangeListing, createExchangeListing, createExchangeOffer, getMyExchangeMarketplace, listExchangeListings, respondExchangeOffer } from "./exchangeMarketplace";
import { cancelItemListing, createItemListing, createItemRequest, getMyItemMarketplace, listItemListings, respondItemRequest } from "./itemMarketplace";
import { assertMarketplaceTabAccess } from "./marketplaceAccess";
import { listMarketplaceHistory } from "./marketplaceHistory";
import { MemberAuthError, getMemberFromToken, getSessionTokenFromHeader } from "./memberAuth";
import { getMarketplaceTabSettings } from "./marketplaceSettings";

type Subscriber = { write: (chunk: string) => void };

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) reject(new Error("PAYLOAD_TOO_LARGE"));
    });
    req.on("end", () => {
      try {
        const value = JSON.parse(body || "{}");
        resolve(value && typeof value === "object" ? value as Record<string, unknown> : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendError(res: ServerResponse, error: unknown) {
  if (error instanceof MemberAuthError) {
    const statusByCode: Record<MemberAuthError["code"], number> = {
      INVALID_INPUT: 400, DUPLICATE_USERNAME: 409, INVALID_CREDENTIALS: 401, PENDING_APPROVAL: 403,
      SUSPENDED: 403, LOGIN_RATE_LIMITED: 429, UNAUTHORIZED: 401, FORBIDDEN: 403, SETUP_ERROR: 500,
    };
    sendJson(res, statusByCode[error.code], { error: error.code, message: error.message });
    return;
  }
  console.error("Vite marketplace API error:", error);
  sendJson(res, 500, { error: "MARKETPLACE_ERROR", message: "거래소 처리 중 오류가 발생했습니다." });
}

export function vitePluginMarketplaceApi(monstersFilePath: string): Plugin {
  const subscribers = new Set<Subscriber>();
  const broadcast = () => {
    const payload = `event: marketplace\nid: ${Date.now()}\ndata: {"changedAt":${Date.now()}}\n\n`;
    subscribers.forEach((subscriber) => {
      try { subscriber.write(payload); } catch { subscribers.delete(subscriber); }
    });
  };

  return {
    name: "mixmaster-marketplace-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/marketplace", async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const pathName = url.pathname;
        try {
          const member = await getMemberFromToken(getSessionTokenFromHeader(req.headers.cookie, req.headers.authorization));
          if (!member) {
            sendJson(res, 401, { error: "UNAUTHORIZED", message: "승인된 회원 로그인이 필요합니다." });
            return;
          }
          if (req.method === "GET" && pathName === "/events") {
            res.writeHead(200, {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            });
            subscribers.add(res);
            res.write(`event: marketplace\ndata: {"connected":true}\n\n`);
            const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
            req.on("close", () => {
              clearInterval(heartbeat);
              subscribers.delete(res);
            });
            return;
          }
          if (req.method === "GET" && pathName === "/tab-settings") {
            sendJson(res, 200, { settings: await getMarketplaceTabSettings() });
            return;
          }
          if (req.method === "GET" && pathName === "/admin/history") {
            if (member.role !== "admin") throw new MemberAuthError("FORBIDDEN", "관리자 권한이 필요합니다.");
            sendJson(res, 200, { records: await listMarketplaceHistory({
              category: url.searchParams.get("category"),
              listingType: url.searchParams.get("listingType"),
              status: url.searchParams.get("status"),
              query: url.searchParams.get("query"),
              days: url.searchParams.get("days"),
              limit: url.searchParams.get("limit"),
            }) });
            return;
          }
          if (req.method === "GET" && pathName === "/listings") {
            await assertMarketplaceTabAccess(member, "sell");
            sendJson(res, 200, { listings: await listMarketplaceListings(url.searchParams.get("query") || "") });
            return;
          }
          if (req.method === "GET" && pathName === "/exchanges") {
            await assertMarketplaceTabAccess(member, "exchange");
            sendJson(res, 200, { exchanges: await listExchangeListings(url.searchParams.get("query") || "") });
            return;
          }
          if (req.method === "GET" && pathName === "/exchanges/mine") {
            sendJson(res, 200, await getMyExchangeMarketplace(member.id));
            return;
          }
          if (req.method === "GET" && pathName === "/items") {
            await assertMarketplaceTabAccess(member, "items");
            sendJson(res, 200, { listings: await listItemListings(url.searchParams.get("query") || "", url.searchParams.get("type") || undefined) });
            return;
          }
          if (req.method === "GET" && pathName === "/items/mine") {
            sendJson(res, 200, await getMyItemMarketplace(member.id));
            return;
          }
          if (req.method === "POST" && pathName === "/items") {
            await assertMarketplaceTabAccess(member, "items");
            const input = await readJsonBody(req);
            const listing = await createItemListing(member, { listingType: input.listingType, itemName: input.itemName, quantity: input.quantity, priceBoxes: input.priceBoxes, wantedItems: input.wantedItems, note: input.note });
            broadcast(); sendJson(res, 201, { listing }); return;
          }
          const itemCancelMatch = pathName.match(/^\/items\/([^/]+)\/cancel$/);
          if (req.method === "PATCH" && itemCancelMatch) {
            const listing = await cancelItemListing(member.id, itemCancelMatch[1]);
            broadcast(); sendJson(res, 200, { listing }); return;
          }
          const itemRequestMatch = pathName.match(/^\/items\/([^/]+)\/requests$/);
          if (req.method === "POST" && itemRequestMatch) {
            await assertMarketplaceTabAccess(member, "items");
            const request = await createItemRequest(member, itemRequestMatch[1], await readJsonBody(req));
            broadcast(); sendJson(res, 201, { request }); return;
          }
          const itemActionMatch = pathName.match(/^\/item-requests\/([^/]+)$/);
          if (req.method === "PATCH" && itemActionMatch) {
            const input = await readJsonBody(req);
            if (input.action !== "accept" && input.action !== "reject" && input.action !== "complete" && input.action !== "cancel") throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 아이템 거래 처리입니다.");
            const request = await respondItemRequest(member.id, itemActionMatch[1], input.action);
            broadcast(); sendJson(res, 200, { request }); return;
          }
          if (req.method === "POST" && pathName === "/exchanges") {
            await assertMarketplaceTabAccess(member, "exchange");
            const input = await readJsonBody(req);
            const monsters = await loadMonsterData(monstersFilePath);
            const toSnapshot = (id: unknown) => {
              const found = monsters.find((candidate) => String(candidate.id || "") === String(id || ""));
              if (!found) throw new MemberAuthError("INVALID_INPUT", "현재 헨치 데이터에서 선택한 헨치를 찾을 수 없습니다.");
              return { id: String(found.id || ""), name: String(found.name || ""), attribute: found.attribute ? String(found.attribute) : null, type: found.type ? String(found.type) : null, level: found.level ? String(found.level) : null };
            };
            const wants = Array.isArray(input.wants) ? input.wants.map((want) => ({ monster: toSnapshot((want as Record<string, unknown>).monsterId), quantity: (want as Record<string, unknown>).quantity })) : [];
            const listing = await createExchangeListing(member, { offered: toSnapshot(input.offeredMonsterId), offeredQuantity: input.offeredQuantity, wants, note: input.note });
            broadcast(); sendJson(res, 201, { listing }); return;
          }
          const exchangeOfferMatch = pathName.match(/^\/exchanges\/([^/]+)\/offers$/);
          if (req.method === "POST" && exchangeOfferMatch) {
            await assertMarketplaceTabAccess(member, "exchange");
            const input = await readJsonBody(req);
            const found = (await loadMonsterData(monstersFilePath)).find((candidate) => String(candidate.id || "") === String(input.offeredMonsterId || ""));
            if (!found) throw new MemberAuthError("INVALID_INPUT", "제안할 헨치를 찾을 수 없습니다.");
            const offer = await createExchangeOffer(member, exchangeOfferMatch[1], { offered: { id: String(found.id || ""), name: String(found.name || ""), attribute: found.attribute ? String(found.attribute) : null, type: found.type ? String(found.type) : null, level: found.level ? String(found.level) : null }, quantity: input.quantity, message: input.message });
            broadcast(); sendJson(res, 201, { offer }); return;
          }
          const exchangeCancelMatch = pathName.match(/^\/exchanges\/([^/]+)\/cancel$/);
          if (req.method === "PATCH" && exchangeCancelMatch) {
            const listing = await cancelExchangeListing(member.id, exchangeCancelMatch[1]);
            broadcast(); sendJson(res, 200, { listing }); return;
          }
          const exchangeActionMatch = pathName.match(/^\/exchange-offers\/([^/]+)$/);
          if (req.method === "PATCH" && exchangeActionMatch) {
            const input = await readJsonBody(req);
            if (input.action !== "accept" && input.action !== "reject" && input.action !== "complete" && input.action !== "cancel") throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 교환 처리입니다.");
            const offer = await respondExchangeOffer(member.id, exchangeActionMatch[1], input.action);
            broadcast(); sendJson(res, 200, { offer }); return;
          }
          if (req.method === "GET" && pathName === "/price-summaries") {
            await assertMarketplaceTabAccess(member, "sell");
            const prices = await getMarketplacePriceSummaries((url.searchParams.get("ids") || "").split(","));
            sendJson(res, 200, { prices });
            return;
          }
          if (req.method === "GET" && pathName === "/mine") {
            const [listings, requests, buyOrders, saleOffers] = await Promise.all([listMyMarketplaceListings(member.id), listMyMarketplaceTradeRequests(member.id), listMyMarketplaceBuyOrders(member.id), listMyMarketplaceSaleOffers(member.id)]);
            sendJson(res, 200, { listings, requests, buyOrders, saleOffers });
            return;
          }
          if (req.method === "POST" && pathName === "/listings") {
            await assertMarketplaceTabAccess(member, "sell");
            const input = await readJsonBody(req);
            const monsterId = typeof input.monsterId === "string" ? input.monsterId : "";
            const monster = (await loadMonsterData(monstersFilePath)).find((candidate) => String(candidate.id || "") === monsterId);
            if (!monster) throw new MemberAuthError("INVALID_INPUT", "현재 헨치 데이터에서 등록할 헨치를 찾을 수 없습니다.");
            const listing = await createMarketplaceListing(member, {
              monster: {
                id: String(monster.id || ""), name: String(monster.name || ""),
                attribute: monster.attribute ? String(monster.attribute) : null,
                type: monster.type ? String(monster.type) : null,
                level: monster.level ? String(monster.level) : null,
              },
              quantity: input.quantity, priceBoxes: input.priceBoxes, note: input.note,
            });
            broadcast();
            sendJson(res, 201, { listing });
            return;
          }
          const cancelListingMatch = pathName.match(/^\/listings\/([^/]+)\/cancel$/);
          if (req.method === "PATCH" && cancelListingMatch) {
            const listing = await cancelMarketplaceListing(member.id, cancelListingMatch[1]);
            broadcast();
            sendJson(res, 200, { listing });
            return;
          }
          const createRequestMatch = pathName.match(/^\/listings\/([^/]+)\/requests$/);
          if (req.method === "POST" && createRequestMatch) {
            await assertMarketplaceTabAccess(member, "sell");
            const input = await readJsonBody(req);
            const request = await createMarketplaceTradeRequest(member, createRequestMatch[1], { message: input.message });
            broadcast();
            sendJson(res, 201, { request });
            return;
          }
          const requestMatch = pathName.match(/^\/requests\/([^/]+)$/);
          if (req.method === "PATCH" && requestMatch) {
            const input = await readJsonBody(req);
            let request;
            if (input.action === "accept" || input.action === "reject") request = await respondToMarketplaceTradeRequest(member.id, requestMatch[1], input.action);
            else if (input.action === "cancel") request = await cancelMarketplaceTradeRequest(member.id, requestMatch[1]);
            else if (input.action === "complete") request = await completeMarketplaceTrade(member.id, requestMatch[1]);
            else throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 거래 요청 처리입니다.");
            broadcast();
            sendJson(res, 200, { request });
            return;
          }
          if (req.method === "GET" && pathName === "/buy-orders") {
            await assertMarketplaceTabAccess(member, "buy");
            sendJson(res, 200, { buyOrders: await listMarketplaceBuyOrders(url.searchParams.get("query") || "") });
            return;
          }
          if (req.method === "POST" && pathName === "/buy-orders") {
            await assertMarketplaceTabAccess(member, "buy");
            const input = await readJsonBody(req);
            const monsterId = typeof input.monsterId === "string" ? input.monsterId : "";
            const monster = (await loadMonsterData(monstersFilePath)).find((candidate) => String(candidate.id || "") === monsterId);
            if (!monster) throw new MemberAuthError("INVALID_INPUT", "현재 헨치 데이터에서 구매할 헨치를 찾을 수 없습니다.");
            const buyOrder = await createMarketplaceBuyOrder(member, { monster: { id: String(monster.id || ""), name: String(monster.name || ""), attribute: monster.attribute ? String(monster.attribute) : null, type: monster.type ? String(monster.type) : null, level: monster.level ? String(monster.level) : null }, quantity: input.quantity, offerBoxes: input.offerBoxes, note: input.note });
            broadcast();
            sendJson(res, 201, { buyOrder });
            return;
          }
          const cancelBuyOrderMatch = pathName.match(/^\/buy-orders\/([^/]+)\/cancel$/);
          if (req.method === "PATCH" && cancelBuyOrderMatch) {
            const buyOrder = await cancelMarketplaceBuyOrder(member.id, cancelBuyOrderMatch[1]);
            broadcast();
            sendJson(res, 200, { buyOrder });
            return;
          }
          const createSaleOfferMatch = pathName.match(/^\/buy-orders\/([^/]+)\/sale-offers$/);
          if (req.method === "POST" && createSaleOfferMatch) {
            await assertMarketplaceTabAccess(member, "buy");
            const input = await readJsonBody(req);
            const offer = await createMarketplaceSaleOffer(member, createSaleOfferMatch[1], { message: input.message });
            broadcast();
            sendJson(res, 201, { offer });
            return;
          }
          const saleOfferMatch = pathName.match(/^\/sale-offers\/([^/]+)$/);
          if (req.method === "PATCH" && saleOfferMatch) {
            const input = await readJsonBody(req);
            let offer;
            if (input.action === "accept" || input.action === "reject") offer = await respondToMarketplaceSaleOffer(member.id, saleOfferMatch[1], input.action);
            else if (input.action === "cancel") offer = await cancelMarketplaceSaleOffer(member.id, saleOfferMatch[1]);
            else if (input.action === "complete") offer = await completeMarketplaceBuyOrder(member.id, saleOfferMatch[1]);
            else throw new MemberAuthError("INVALID_INPUT", "지원하지 않는 판매 제안 처리입니다.");
            broadcast();
            sendJson(res, 200, { offer });
            return;
          }
          next();
        } catch (error) {
          sendError(res, error);
        }
      });
    },
  };
}
