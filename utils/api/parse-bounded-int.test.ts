import { describe, expect, it } from "vitest";

import { parseBoundedInt } from "./parse-bounded-int";

const base = { defaultValue: 10, min: 1, max: 100 };

describe("parseBoundedInt", () => {
  it("returns parsed value when in range", () => {
    expect(parseBoundedInt({ ...base, value: "42" })).toBe(42);
  });

  it("uses default when value is null", () => {
    expect(parseBoundedInt({ ...base, value: null })).toBe(10);
  });

  it("clamps below min", () => {
    expect(parseBoundedInt({ ...base, value: "0" })).toBe(1);
  });

  it("clamps above max", () => {
    expect(parseBoundedInt({ ...base, value: "500" })).toBe(100);
  });

  it("uses default for non-numeric input", () => {
    expect(parseBoundedInt({ ...base, value: "abc" })).toBe(10);
  });

  it("uses default for NaN", () => {
    expect(parseBoundedInt({ ...base, value: "NaN" })).toBe(10);
  });
});
