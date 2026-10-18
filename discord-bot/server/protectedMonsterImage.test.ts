import { beforeEach, describe, expect, it, vi } from "vitest";

const { storageGetMock } = vi.hoisted(() => ({ storageGetMock: vi.fn() }));

vi.mock("./storage.js", () => ({ storageGet: storageGetMock }));

import { MAX_PROTECTED_MONSTER_IMAGE_BYTES, PROTECTED_MONSTER_IMAGE_HEADERS, readProtectedMonsterImage } from "./protectedMonsterImage";

const registeredMonsters = [{ id: "hench-1", imageUrl: "/manus-storage/monster-images/hench-1_a1b2c3d4.webp" }];

describe("protected monster image streaming", () => {
  beforeEach(() => {
    storageGetMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("does not request a storage URL for an unregistered or malformed image key", async () => {
    await expect(readProtectedMonsterImage(registeredMonsters, "monster-images/other_a1b2c3d4.webp")).resolves.toBeNull();
    await expect(readProtectedMonsterImage(registeredMonsters, "../monster-images/hench-1.webp")).resolves.toBeNull();
    expect(storageGetMock).not.toHaveBeenCalled();
  });

  it("reads approved image bytes server-side without redirecting the signed storage URL to the browser", async () => {
    storageGetMock.mockResolvedValue("https://signed-storage.example/image.webp");
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "image/webp" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readProtectedMonsterImage(registeredMonsters, "monster-images/hench-1_a1b2c3d4.webp")).resolves.toEqual({
      bytes: Buffer.from([1, 2, 3]),
      contentType: "image/webp",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://signed-storage.example/image.webp", { redirect: "error" });
  });

  it("accepts a generic storage MIME only when the returned bytes have a WebP signature", async () => {
    storageGetMock.mockResolvedValue("https://signed-storage.example/image.webp");
    const webpBytes = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from([1, 2, 3])]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(webpBytes, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    })));

    await expect(readProtectedMonsterImage(registeredMonsters, "monster-images/hench-1_a1b2c3d4.webp")).resolves.toEqual({
      bytes: webpBytes,
      contentType: "image/webp",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    })));
    await expect(readProtectedMonsterImage(registeredMonsters, "monster-images/hench-1_a1b2c3d4.webp")).rejects.toThrow("unexpected content type");
  });

  it("uses private, same-origin and no-referrer headers for every protected image response", () => {
    expect(PROTECTED_MONSTER_IMAGE_HEADERS).toMatchObject({
      "Cache-Control": expect.stringContaining("no-store"),
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      Vary: "Cookie",
    });
  });

  it("allows the expanded high-quality WebP limit and rejects oversized files", async () => {
    storageGetMock.mockResolvedValue("https://signed-storage.example/image.webp");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(MAX_PROTECTED_MONSTER_IMAGE_BYTES), {
      status: 200,
      headers: { "Content-Type": "image/webp" },
    })));
    await expect(readProtectedMonsterImage(registeredMonsters, "monster-images/hench-1_a1b2c3d4.webp")).resolves.toMatchObject({
      bytes: expect.any(Buffer),
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(MAX_PROTECTED_MONSTER_IMAGE_BYTES + 1), {
      status: 200,
      headers: { "Content-Type": "image/webp" },
    })));
    await expect(readProtectedMonsterImage(registeredMonsters, "monster-images/hench-1_a1b2c3d4.webp")).rejects.toThrow("unexpected size");
  });
});
