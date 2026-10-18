// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockEventSource {
  addEventListener = vi.fn();
  close = vi.fn();
}

describe("useMonsterData", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("revalidates the shared monster snapshot through browser cache instead of forcing a full reload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "1", name: "테스트", attribute: "악마" }]), { status: 200, headers: { ETag: "test-etag" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { useMonsterData } = await import("./useMonsterData");

    const { result, unmount } = renderHook(() => useMonsterData());

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/monsters", expect.objectContaining({ cache: "no-cache" }));
    unmount();
  });
});
