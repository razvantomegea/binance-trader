import { describe, expect, it } from "vitest";

import { hasGainVsAnyRef, hasLossVsAnyRef } from "./price-change-conditions";

describe("hasGainVsAnyRef", () => {
  it("returns true when gain meets threshold", () => {
    expect(
      hasGainVsAnyRef({ reference: 110, refs: [100], thresholdPct: 0.1 }),
    ).toBe(true);
  });

  it("returns false when gain is below threshold", () => {
    expect(
      hasGainVsAnyRef({ reference: 105, refs: [100], thresholdPct: 0.1 }),
    ).toBe(false);
  });

  it("ignores non-positive refs", () => {
    expect(
      hasGainVsAnyRef({ reference: 200, refs: [0, -5], thresholdPct: 0.1 }),
    ).toBe(false);
  });
});

describe("hasLossVsAnyRef", () => {
  it("returns true when loss meets threshold", () => {
    expect(
      hasLossVsAnyRef({ reference: 85, refs: [100], thresholdPct: 0.1 }),
    ).toBe(true);
  });

  it("returns false when loss is below threshold", () => {
    expect(
      hasLossVsAnyRef({ reference: 95, refs: [100], thresholdPct: 0.1 }),
    ).toBe(false);
  });

  it("ignores non-positive refs", () => {
    expect(
      hasLossVsAnyRef({ reference: 50, refs: [0], thresholdPct: 0.1 }),
    ).toBe(false);
  });
});
