/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAntiCapture } from "./useAntiCapture";

function SecurityProbe() {
  useAntiCapture();
  return null;
}

describe("useAntiCapture security reporting", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("reports a blocked copy shortcut once with the current route", async () => {
    window.history.pushState({}, "", "/tree");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    render(<SecurityProbe />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/security-events", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ eventType: "copy_shortcut", path: "/tree" }),
      keepalive: true,
    }));
  });

  it("reports Print Screen without applying a visual blur or blocking interaction", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    render(<SecurityProbe />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "PrintScreen", cancelable: true }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/security-events", expect.objectContaining({
      body: JSON.stringify({ eventType: "print_screen_key", path: "/" }),
    })));
    expect(document.body.style.filter).toBe("");
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("records focus loss without adding a blur style to the site", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    render(<SecurityProbe />);

    window.dispatchEvent(new Event("blur"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/security-events", expect.objectContaining({
      body: JSON.stringify({ eventType: "focus_lost", path: "/" }),
    })));
    expect(document.body.style.filter).toBe("");
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("blocks a direct copy event and records the attempt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    render(<SecurityProbe />);
    const copyEvent = new Event("copy", { cancelable: true });

    document.dispatchEvent(copyEvent);

    expect(copyEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/security-events", expect.objectContaining({
      body: JSON.stringify({ eventType: "copy_shortcut", path: "/" }),
    })));
  });
});
