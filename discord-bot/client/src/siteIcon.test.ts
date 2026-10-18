import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("site icon metadata", () => {
  it("uses the login-background character icon for both browser and mobile home-screen metadata", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    const iconUrl = "/manus-storage/abyss-character-site-icon-512_6ecd4cc9.png";

    expect(html).toContain(`<link rel="icon" type="image/png" sizes="512x512" href="${iconUrl}" />`);
    expect(html).toContain(`<link rel="apple-touch-icon" sizes="512x512" href="${iconUrl}" />`);
  });
});
