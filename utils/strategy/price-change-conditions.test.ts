import { describe, expect, it } from "vitest";

import { ENTRY_RANGE_PCT, EXIT_DRAWDOWN_PCT } from "@/constants/binance";

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

  it("returns true at exactly 50% gain boundary", () => {
    expect(
      hasGainVsAnyRef({
        reference: 150,
        refs: [100],
        thresholdPct: ENTRY_RANGE_PCT,
      }),
    ).toBe(true);
  });

  it("returns false just below 50% gain", () => {
    expect(
      hasGainVsAnyRef({
        reference: 149,
        refs: [100],
        thresholdPct: ENTRY_RANGE_PCT,
      }),
    ).toBe(false);
  });

  it("returns true above 50% gain", () => {
    expect(
      hasGainVsAnyRef({
        reference: 200,
        refs: [100],
        thresholdPct: ENTRY_RANGE_PCT,
      }),
    ).toBe(true);
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

  it("returns true at exactly 10% loss boundary", () => {
    expect(
      hasLossVsAnyRef({
        reference: 90,
        refs: [100],
        thresholdPct: EXIT_DRAWDOWN_PCT,
      }),
    ).toBe(true);
  });

  it("returns false when loss is less than 10%", () => {
    expect(
      hasLossVsAnyRef({
        reference: 91,
        refs: [100],
        thresholdPct: EXIT_DRAWDOWN_PCT,
      }),
    ).toBe(false);
  });
});
