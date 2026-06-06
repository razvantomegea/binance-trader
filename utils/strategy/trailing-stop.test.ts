import { describe, expect, it } from "vitest";

import {
  getTrailingExitPrice,
  getTrailingReferencePrice,
  getUpdatedPeakPrice,
  getWorstObservedPrice,
  resolveTrailingSellPrice,
  shouldTriggerTrailingStop,
} from "@/utils/strategy/trailing-stop";

const THRESHOLD = 0.15;

describe("trailing-stop", () => {
  it("uses max(entry, peak) as trailing reference", () => {
    expect(
      getTrailingReferencePrice({ buyPrice: 100, maxPriceAfterBuy: 200 }),
    ).toBe(200);
    expect(
      getTrailingReferencePrice({ buyPrice: 100, maxPriceAfterBuy: 90 }),
    ).toBe(100);
  });

  it("triggers when worst price breaches 15% below trailing ref", () => {
    expect(
      shouldTriggerTrailingStop({
        position: { buyPrice: 100, maxPriceAfterBuy: 200 },
        worstPrice: 169,
        thresholdPct: THRESHOLD,
      }),
    ).toBe(true);
    expect(
      shouldTriggerTrailingStop({
        position: { buyPrice: 100, maxPriceAfterBuy: 200 },
        worstPrice: 171,
        thresholdPct: THRESHOLD,
      }),
    ).toBe(false);
  });

  it("triggers on intrabar low before hourly close recovers", () => {
    expect(
      shouldTriggerTrailingStop({
        position: { buyPrice: 100, maxPriceAfterBuy: 100 },
        worstPrice: 84,
        thresholdPct: THRESHOLD,
      }),
    ).toBe(true);
  });

  it("caps sell price at trailing stop when market gaps lower", () => {
    expect(
      resolveTrailingSellPrice({
        position: { buyPrice: 100, maxPriceAfterBuy: 100 },
        marketPrice: 60,
        thresholdPct: THRESHOLD,
      }),
    ).toBe(85);
  });

  it("uses market price when above trailing stop", () => {
    expect(
      resolveTrailingSellPrice({
        position: { buyPrice: 100, maxPriceAfterBuy: 200 },
        marketPrice: 180,
        thresholdPct: THRESHOLD,
      }),
    ).toBe(180);
  });

  it("exit price is 15% below entry when peak never exceeded entry", () => {
    expect(
      getTrailingExitPrice({
        position: { buyPrice: 100, maxPriceAfterBuy: 100 },
        thresholdPct: THRESHOLD,
      }),
    ).toBe(85);
  });

  it("tracks peak from high and mark", () => {
    expect(
      getUpdatedPeakPrice({
        currentMax: 100,
        high: 120,
        close: 110,
        markPrice: 115,
      }),
    ).toBe(120);
  });

  it("worst price is min of low and mark", () => {
    expect(getWorstObservedPrice({ low: 80, markPrice: 95 })).toBe(80);
  });
});
