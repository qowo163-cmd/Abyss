import { afterEach, describe, expect, it } from "vitest";
import type { PublicMember } from "./memberAuth";
import { assertMarketplaceRegistrationAccess, MARKETPLACE_REGISTRATION_OPEN } from "./marketplaceAccess";
import { setMarketplaceTabSettingsPoolForTesting } from "./marketplaceSettings";

const member = (role: PublicMember["role"]): PublicMember => ({
  id: `${role}-member`, username: role, nickname: role, discordNickname: role, gameNickname: role,
  role, status: "approved", approvedAt: new Date().toISOString(), lastActivityAt: null, createdAt: new Date().toISOString(),
});

describe("marketplace open registration access", () => {
  afterEach(() => setMarketplaceTabSettingsPoolForTesting(undefined));

  it("allows administrators and approved regular members while the marketplace is open", async () => {
    setMarketplaceTabSettingsPoolForTesting({ query: async () => [[], []], execute: async () => [[], []] } as never);
    expect(MARKETPLACE_REGISTRATION_OPEN).toBe(true);
    await expect(assertMarketplaceRegistrationAccess(member("admin"), "sell")).resolves.toBeUndefined();
    await expect(assertMarketplaceRegistrationAccess(member("member"), "sell")).resolves.toBeUndefined();
  });

  it("continues to block an unapproved non-administrator account", async () => {
    setMarketplaceTabSettingsPoolForTesting({ query: async () => [[], []], execute: async () => [[], []] } as never);
    await expect(assertMarketplaceRegistrationAccess({ ...member("member"), status: "pending" }, "items")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
