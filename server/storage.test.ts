import { afterEach, describe, expect, it, vi } from "vitest";
import { storageGet, storagePut } from "./storage";

describe("storagePut", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests a presigned URL, uploads bytes, and returns a Manus storage URL", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.test";
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://s3.example.test/upload" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await storagePut("monster-images/test.png", new Uint8Array([1, 2, 3]), "image/png");

    expect(result.key).toMatch(/^monster-images\/test_[a-f0-9]{8}\.png$/);
    expect(result.url).toBe(`/api/monster-image?key=${encodeURIComponent(result.key)}`);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const presignCall = fetchMock.mock.calls[0];
    expect(String(presignCall[0])).toContain("/v1/storage/presign/put?path=");
    expect((presignCall[1] as RequestInit).headers).toEqual({ Authorization: "Bearer test-key" });

    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall[0]).toBe("https://s3.example.test/upload");
    expect((uploadCall[1] as RequestInit).method).toBe("PUT");
    expect((uploadCall[1] as RequestInit).headers).toEqual({ "Content-Type": "image/png" });
  });

  it("requests a signed URL for protected image reads", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.test";
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ url: "https://s3.example.test/read" }), { status: 200 }),
    );

    await expect(storageGet("monster-images/test.webp")).resolves.toBe("https://s3.example.test/read");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/storage/presign/get?path=monster-images%2Ftest.webp");
  });
});
