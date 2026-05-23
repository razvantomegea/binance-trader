import { describe, expect, it } from "vitest";

import { parseSingleCandleInterval } from "./parse-candle-interval";

describe("parseSingleCandleInterval", () => {
  it("returns default when value is null", () => {
    expect(parseSingleCandleInterval(null)).toBe("H1");
  });

  it("parses valid interval case-insensitively", () => {
    expect(parseSingleCandleInterval("h1")).toBe("H1");
  });

  it("uses custom default when value is null", () => {
    expect(parseSingleCandleInterval(null, "H1")).toBe("H1");
  });

  it("returns null for unknown interval", () => {
    expect(parseSingleCandleInterval("M5")).toBeNull();
  });

  it("returns null for empty string after trim", () => {
    expect(parseSingleCandleInterval("   ")).toBeNull();
  });
});
