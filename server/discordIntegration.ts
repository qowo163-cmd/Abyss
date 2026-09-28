import { randomBytes, randomUUID } from "node:crypto";
import mysql, { type Pool } from "mysql2/promise";
import { MemberAuthError, type PublicMember, findMemberById, loginMember } from "./memberAuth.js";
import { listMarketplaceListings, listMyMarketplaceListings, createMarketplaceListing, cancelMarketplaceListing } from "./marketplace.js";
import { listExchangeListings, getMyExchangeMarketplace, createExchangeListing, cancelExchangeListing } from "./exchangeMarketplace.js";

let pool: Pool | undefined;
function db() { if (pool) return pool; if (!process.env.DATABASE_URL) throw new MemberAuthError("SETUP_ERROR", "DATABASE_URL이 설정되지 않았습니다."); pool = mysql.createPool(process.env.DATABASE_URL); return pool; }
function rows(result: unknown): Record<string, any>[] { return Array.isArray(result) && Array.isArray(result[0]) ? result[0] as Record<string, any>[] : []; }
function internalSecret(req: any) { return typeof req.headers["x-abyss-discord-secret"] === "string" && req.headers["x-abyss-discord-secret"] === process.env.DISCORD_INTERNAL_SECRET; }
function assertInternal(req: any) { if (!process.env.DISCORD_INTERNAL_SECRET || !internalSecret(req)) throw new MemberAuthError("FORBIDDEN", "Discord 연동 인증이 필요합니다."); }

export async function createDiscordLinkCode(memberId: string) {
  const code = randomBytes(4).toString("hex").toUpperCase();
  await db().execute("DELETE FROM discord_link_codes WHERE member_id=? OR expires_at < NOW()", [memberId]);
  await db().execute("INSERT INTO discord_link_codes (code, member_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))", [code, memberId]);
  return code;
}

export async function consumeDiscordLinkCode(code: string, discordUserId: string, discordUsername: string) {
  const result = await db().query("SELECT code, member_id AS memberId FROM discord_link_codes WHERE code=? AND used_at IS NULL AND expires_at > NOW() LIMIT 1", [code.trim().toUpperCase()]);
  const row = rows(result)[0];
  if (!row) throw new MemberAuthError("INVALID_INPUT", "연동 코드가 없거나 만료되었습니다.");
  const memberId = String(row.memberId);
  const member = await findMemberById(memberId);
  if (!member) throw new MemberAuthError("INVALID_INPUT", "회원을 찾을 수 없습니다.");
  await db().execute("INSERT INTO discord_links (member_id, discord_user_id, discord_username) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE discord_user_id=VALUES(discord_user_id), discord_username=VALUES(discord_username), linked_at=NOW()", [memberId, discordUserId, discordUsername.slice(0,100)]);
  await db().execute("UPDATE discord_link_codes SET used_at=NOW() WHERE code=?", [code.trim().toUpperCase()]);
  return member;
}

export async function unlinkDiscord(memberId: string) { await db().execute("DELETE FROM discord_links WHERE member_id=?", [memberId]); }

export async function enqueueDiscordMarketplaceAlert(alert: { recipientMemberId: string; kind: string; title: string; body: string }) {
  await db().execute("INSERT INTO discord_notifications (id, recipient_member_id, title, body, kind) VALUES (?, ?, ?, ?, ?)", [randomUUID(), alert.recipientMemberId, alert.title.slice(0,120), alert.body.slice(0,500), alert.kind.slice(0,40)]);
}

export async function pollDiscordNotifications(limit=20) {
  const result = await db().query(`SELECT n.id, n.recipient_member_id AS recipientMemberId, n.title, n.body, n.kind, l.discord_user_id AS discordUserId FROM discord_notifications n INNER JOIN discord_links l ON l.member_id=n.recipient_member_id WHERE n.sent_at IS NULL ORDER BY n.created_at ASC LIMIT ?`, [Math.min(limit,50)]);
  return rows(result);
}
export async function markDiscordNotificationSent(id:string) { await db().execute("UPDATE discord_notifications SET sent_at=NOW() WHERE id=? AND sent_at IS NULL", [id]); }

export async function internalLink(req:any, res:any) { try { assertInternal(req); const code=String(req.body?.code||""); const userId=String(req.body?.discordUserId||""); const username=String(req.body?.discordUsername||""); if(!code||!userId) throw new MemberAuthError("INVALID_INPUT","연동 코드와 Discord 사용자 ID가 필요합니다."); const member=await consumeDiscordLinkCode(code,userId,username); res.json({member:{id:member.id,nickname:member.nickname,gameNickname:member.gameNickname}}); } catch(e){ res.status(e instanceof MemberAuthError ? (e.code==='FORBIDDEN'?403:400):500).json({error:e instanceof Error?e.message:"연동 실패"}); } }

async function memberOrThrow(memberId:string):Promise<PublicMember>{ const member=await findMemberById(memberId); if(!member || member.status!=="approved") throw new MemberAuthError("FORBIDDEN","승인된 회원만 Discord 거래소 기능을 사용할 수 있습니다."); return member; }
export async function internalMarketplace(req:any,res:any){
  try { assertInternal(req); const member=await memberOrThrow(String(req.body?.memberId||req.query?.memberId||"")); const action=String(req.body?.action||req.query?.action||"");
    if(action==='sell-list') return res.json({listings:await listMarketplaceListings(String(req.body?.query||req.query?.query||""))});
    if(action==='exchange-list') return res.json({exchanges:await listExchangeListings(String(req.body?.query||req.query?.query||""))});
    if(action==='my-sell') return res.json({listings:await listMyMarketplaceListings(member.id)});
    if(action==='my-exchange') return res.json(await getMyExchangeMarketplace(member.id));
    if(action==='sell-create') { const listing=await createMarketplaceListing(member,{monster:req.body.monster,quantity:req.body.quantity,unitPriceBoxes:req.body.unitPriceBoxes,note:req.body.note}); return res.status(201).json({listing}); }
    if(action==='sell-cancel') { return res.json({listing:await cancelMarketplaceListing(member.id,String(req.body.id))}); }
    if(action==='exchange-create') { const listing=await createExchangeListing(member,{offered:req.body.offered,offeredQuantity:req.body.offeredQuantity,wants:req.body.wants,note:req.body.note}); return res.status(201).json({listing}); }
    if(action==='exchange-cancel') { return res.json({listing:await cancelExchangeListing(member.id,String(req.body.id))}); }
    throw new MemberAuthError("INVALID_INPUT","지원하지 않는 Discord 거래소 작업입니다.");
  } catch(e){ const status=e instanceof MemberAuthError?(e.code==='FORBIDDEN'?403:400):500; res.status(status).json({error:e instanceof Error?e.message:"거래소 처리 실패"}); }
}

