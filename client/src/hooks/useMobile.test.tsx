/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./useMobile";

function MobileProbe() {
  return <span>{useIsMobile() ? "mobile" : "desktop"}</span>;
}

describe("useIsMobile", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("detects a mobile viewport on the first render", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });

    render(<MobileProbe />);

    expect(screen.getByText("mobile")).toBeInTheDocument();
  });

  it("keeps desktop rendering for desktop-sized viewports", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });

    render(<MobileProbe />);

    expect(screen.getByText("desktop")).toBeInTheDocument();
  });
});
