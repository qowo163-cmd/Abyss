/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnlineMemberCount } from "./OnlineMemberCount";

describe("OnlineMemberCount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and displays only the current approved-member count", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 4 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<OnlineMemberCount />);

    expect(screen.getByText("현재 접속")).toBeInTheDocument();
    expect(await screen.findByText("4명")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/online-count", { cache: "no-cache" }));
  });
});
