import { describe, expect, it } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import {
  get24hHighLow,
  getCloseHighLow,
  isEntryBandCandidate,
  type CandleSlice,
} from "@/helpers/strategy/decision-core";

const HOUR_MS = 3_600_000;

function makeCandle(
  openTime: number,
  close: number,
  overrides: Partial<Pick<CandleSlice, "high" | "low">> = {},
): CandleSlice {
  return {
    openTime,
    high: overrides.high ?? close,
    low: overrides.low ?? close,
    close,
  };
}

function makeCandles(
  startOpenTime: number,
  specs: Array<number | { close: number; high?: number; low?: number }>,
): CandleSlice[] {
  return specs.map((spec, i) => {
    const openTime = startOpenTime - i * HOUR_MS;
    if (typeof spec === "number") {
      return makeCandle(openTime, spec);
    }
    return makeCandle(openTime, spec.close, {
      high: spec.high,
      low: spec.low,
    });
  });
}

describe("get24hHighLow", () => {
  it("returns highest high and lowest low with their open times", () => {
    const closed = [
      { openTime: 3000, high: 105, low: 95 },
      { openTime: 2000, high: 120, low: 80 },
      { openTime: 1000, high: 110, low: 90 },
    ];

    expect(get24hHighLow(closed)).toEqual({
      high24h: 120,
      low24h: 80,
      highOpenTime: 2000,
      lowOpenTime: 2000,
    });
  });
});

describe("getCloseHighLow", () => {
  it("returns highest and lowest close values", () => {
    const closed = [{ close: 150 }, { close: 100 }, { close: 200 }];

    expect(getCloseHighLow(closed)).toEqual({
      highClose: 200,
      lowClose: 100,
    });
  });
});

describe("isEntryBandCandidate", () => {
  it("returns false when lookback window is incomplete", () => {
    const closed = makeCandles(1000 * HOUR_MS, Array(10).fill(150));

    expect(isEntryBandCandidate({ closed })).toBe(false);
  });

  it("returns true when latest and highest close are within entry band", () => {
    const closed = makeCandles(1000 * HOUR_MS, [
      155,
      160,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    expect(isEntryBandCandidate({ closed })).toBe(true);
  });

  it("returns false when latest close is outside entry band", () => {
    const closed = makeCandles(1000 * HOUR_MS, [
      180,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    expect(isEntryBandCandidate({ closed })).toBe(false);
  });

  it("returns false when highest close is outside entry band", () => {
    const closed = makeCandles(1000 * HOUR_MS, [
      155,
      190,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    expect(isEntryBandCandidate({ closed })).toBe(false);
  });
});
