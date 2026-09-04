/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { appendServerUpdate, mergeUpdates, normalizeChanges, normalizeUpdates, type UpdateItem } from "./updates";
import updatesJson from "@/data/updates.json";


describe("updates helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("normalizes legacy string changes into an array", () => {
    expect(normalizeChanges("첫 번째\n두 번째")).toEqual(["첫 번째", "두 번째"]);
    expect(normalizeUpdates([{ id: "u1", title: "기록", changes: "한 줄" }])[0]?.changes).toEqual(["한 줄"]);
  });

  it("appends one update through the server append endpoint", async () => {
    const updates: UpdateItem[] = [{ id: "u1", date: "2026-08-17T00:00:00.000Z", version: "v1", title: "새 기록", description: "", changes: ["변경"], type: "feature" }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, updates }), { status: 200 }));

    const result = await appendServerUpdate(updates[0]);

    expect(fetchMock).toHaveBeenCalledWith("/api/updates/append", expect.objectContaining({ method: "POST" }));
    expect(result).toEqual(updates);
  });

  it("deduplicates updates by id and keeps the newest ordering", () => {
    const result = mergeUpdates(
      [{ id: "u2", date: "2026-08-17T00:00:00.000Z", version: "v2", title: "최신", description: "", changes: [], type: "feature" }],
      [{ id: "u2", date: "2026-08-16T00:00:00.000Z", version: "v1", title: "중복", description: "", changes: [], type: "feature" }, { id: "u1", date: "2026-08-15T00:00:00.000Z", version: "v1", title: "이전", description: "", changes: [], type: "fix" }],
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe("최신");
  });

  it("preserves adjacent historical releases like v3.6.0 and v3.5.0", () => {
    const normalized = normalizeUpdates(updatesJson);
    const v360 = normalized.find((u) => u.version === "v3.6.0");
    const v350 = normalized.find((u) => u.version === "v3.5.0");
    expect(v360).toBeDefined();
    expect(v350).toBeDefined();
  });
});
