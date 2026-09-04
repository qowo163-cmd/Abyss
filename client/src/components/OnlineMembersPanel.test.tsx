// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OnlineMembersPanel from "./OnlineMembersPanel";

describe("OnlineMembersPanel", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("shows active member count and member identity returned by the admin endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 1, members: [{ id: "m-1", username: "abyss", nickname: "운영자", gameNickname: "관리자캐릭터", role: "admin", lastActivityAt: "2026-08-20T00:00:00.000Z" }] }) }));
    render(<OnlineMembersPanel />);
    expect(await screen.findByText("관리자캐릭터")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument();
    expect(screen.getByText("관리자캐릭터")).toHaveClass("text-cyan-200", "font-bold");
    expect(screen.getByText("운영자")).toHaveClass("text-slate-100", "font-semibold");
  });
});
