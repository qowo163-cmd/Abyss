import { describe, expect, it } from "vitest";
import { formatFileSize, getScaledDimensions, MAX_IMAGE_EDGE, MAX_OPTIMIZED_IMAGE_BYTES } from "./imageOptimizer";

describe("image optimizer helpers", () => {
  it("keeps small images unchanged and scales large images to the maximum edge", () => {
    expect(getScaledDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(getScaledDimensions(4096, 2048)).toEqual({ width: MAX_IMAGE_EDGE, height: 1024 });
    expect(getScaledDimensions(1600, 3200)).toEqual({ width: 1024, height: MAX_IMAGE_EDGE });
  });

  it("formats byte sizes for upload feedback", () => {
    expect(formatFileSize(512)).toBe("512B");
    expect(formatFileSize(1536)).toBe("1.5KB");
    expect(formatFileSize(MAX_OPTIMIZED_IMAGE_BYTES)).toBe("6.0MB");
  });

  it("uses a 2048px high-quality ceiling while preserving the source aspect ratio", () => {
    expect(MAX_IMAGE_EDGE).toBe(2048);
    expect(getScaledDimensions(4096, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(getScaledDimensions(1600, 3200)).toEqual({ width: 1024, height: 2048 });
  });
});
