import { describe, expect, it } from "vitest";

import { safePct, safeRatio } from "./safe-number";

describe("safeRatio", () => {
  it("returns numerator divided by denominator for valid inputs", () => {
    expect(safeRatio(10, 4)).toBe(2.5);
  });

  it("returns 0 when denominator is zero", () => {
    expect(safeRatio(10, 0)).toBe(0);
  });

  it("returns 0 when denominator is negative", () => {
    expect(safeRatio(10, -1)).toBe(0);
  });

  it("returns 0 when denominator is not finite", () => {
    expect(safeRatio(10, Number.NaN)).toBe(0);
    expect(safeRatio(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("safePct", () => {
  it("returns ratio multiplied by 100", () => {
    expect(safePct(5, 200)).toBe(2.5);
  });

  it("returns 0 for invalid denominator", () => {
    expect(safePct(5, 0)).toBe(0);
  });
});
