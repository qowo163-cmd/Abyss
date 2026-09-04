import { MemberAuthError, type PublicMember } from "./memberAuth.js";
import { getMarketplaceTabSettings, type MarketplaceTab } from "./marketplaceSettings.js";

export const PRELAUNCH_MARKETPLACE_REGISTRATION_MESSAGE = "거래소 정식 오픈 전까지는 관리자만 거래글을 등록할 수 있습니다.";
export const MARKETPLACE_REGISTRATION_OPEN = true;
const MARKETPLACE_TAB_LABEL: Record<MarketplaceTab, string> = { sell: "판매중", buy: "구매중", exchange: "교환중", items: "아이템 거래" };

export async function assertMarketplaceTabAccess(member: PublicMember, tab: MarketplaceTab) {
  if (member.role === "admin") return;
  const settings = await getMarketplaceTabSettings();
  if (!settings[`${tab}Enabled`]) {
    throw new MemberAuthError("FORBIDDEN", `현재 ${MARKETPLACE_TAB_LABEL[tab]} 탭은 관리자에 의해 일시적으로 비활성화되었습니다.`);
  }
}

export async function assertMarketplaceRegistrationAccess(member: PublicMember, tab: MarketplaceTab) {
  if (!MARKETPLACE_REGISTRATION_OPEN && member.role !== "admin") {
    throw new MemberAuthError("FORBIDDEN", PRELAUNCH_MARKETPLACE_REGISTRATION_MESSAGE);
  }
  if (member.role !== "admin" && member.status !== "approved") {
    throw new MemberAuthError("FORBIDDEN", "승인된 회원만 거래글을 등록할 수 있습니다.");
  }
  await assertMarketplaceTabAccess(member, tab);
}
