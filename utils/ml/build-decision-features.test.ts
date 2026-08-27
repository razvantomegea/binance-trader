import { describe, expect, it } from "vitest";

import type { CandleSlice } from "@/helpers/strategy/decision-core";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import { makeCandleSlice } from "@/test/candle-fixtures";
import { HOUR_MS } from "@/utils/binance/candle-time";

import { buildDecisionFeatures } from "./build-decision-features";

describe("buildDecisionFeatures", () => {
  it("returns zero-filled features for empty input", () => {
    const result = buildDecisionFeatures({ closed: [] });

    expect(result.featureNames).toHaveLength(12);
    expect(result.features).toHaveLength(12);
    expect(result.features.every((value) => value === 0)).toBe(true);
  });

  it("computes feature vector for non-empty candles", () => {
    const latestOpenTime = 10 * HOUR_MS;
    const closed: CandleSlice[] = [
      makeCandleSlice(latestOpenTime, 105, { high: 106, low: 100 }),
      makeCandleSlice(latestOpenTime - HOUR_MS, 100, { high: 101, low: 98 }),
      makeCandleSlice(latestOpenTime - 2 * HOUR_MS, 95, { high: 96, low: 94 }),
    ];

    const result = buildDecisionFeatures({
      closed,
      strategyParams: DEFAULT_STRATEGY_PARAMS,
    });

    expect(result.featureNames).toContain("closeGainVsLowClose");
    expect(result.features.every((value) => Number.isFinite(value))).toBe(true);
    expect(result.features[0]).toBeGreaterThan(0);
  });

  it("handles a single candle without return volatility", () => {
    const result = buildDecisionFeatures({
      closed: [makeCandleSlice(HOUR_MS, 105, { high: 106, low: 100 })],
    });

    expect(result.features.every((value) => Number.isFinite(value))).toBe(true);
    expect(result.features[8]).toBe(0);
  });

  it("respects custom strategy params for entry band features", () => {
    const latestOpenTime = 5 * HOUR_MS;
    const closed: CandleSlice[] = [
      makeCandleSlice(latestOpenTime, 140, { high: 141, low: 139 }),
      makeCandleSlice(latestOpenTime - HOUR_MS, 120, { high: 121, low: 119 }),
      makeCandleSlice(latestOpenTime - 2 * HOUR_MS, 100, {
        high: 101,
        low: 99,
      }),
    ];

    const inBand = buildDecisionFeatures({
      closed,
      strategyParams: {
        ...DEFAULT_STRATEGY_PARAMS,
        entryRangePct: 0.3,
        entryRangeMaxPct: 0.5,
      },
    });

    const outOfBand = buildDecisionFeatures({
      closed,
      strategyParams: {
        ...DEFAULT_STRATEGY_PARAMS,
        entryRangePct: 0.5,
        entryRangeMaxPct: 0.6,
      },
    });

    expect(inBand.features[2]).toBe(1);
    expect(outOfBand.features[2]).toBe(0);
  });
});
