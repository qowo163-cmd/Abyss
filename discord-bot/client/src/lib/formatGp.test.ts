import { describe, expect, it } from "vitest";
import { formatGpAmount, gpFromEokCount } from "./formatGp";

describe("formatGpAmount", () => {
  it("formats GP values from ten million through one thousand eok in Korean units", () => {
    expect(formatGpAmount(10_000_000)).toBe("1천만 GP");
    expect(formatGpAmount(100_000_000)).toBe("1억 GP");
    expect(formatGpAmount(1_500_000_000)).toBe("15억 GP");
    expect(formatGpAmount(100_000_000_000)).toBe("1,000억 GP");
  });

  it("converts the auto-hunt box eok count into the exact stored GP amount", () => {
    expect(gpFromEokCount(1)).toBe(100_000_000);
    expect(gpFromEokCount(15)).toBe(1_500_000_000);
    expect(gpFromEokCount(1000)).toBe(100_000_000_000);
  });
});
