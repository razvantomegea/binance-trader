import { describe, expect, it } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import {
  get24hHighLow,
  getCloseHighLow,
  isEntryBandCandidate,
} from "@/helpers/strategy/decision-core";
import { makeCandleSlices } from "@/test/candle-fixtures";
import { HOUR_MS } from "@/utils/binance/candle-time";

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
    const closed = makeCandleSlices(1000 * HOUR_MS, Array(10).fill(150));

    expect(isEntryBandCandidate({ closed })).toBe(false);
  });

  it("returns true when latest and highest close are within entry band", () => {
    const closed = makeCandleSlices(1000 * HOUR_MS, [
      130,
      140,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    expect(isEntryBandCandidate({ closed })).toBe(true);
  });

  it("returns false when latest close is outside entry band", () => {
    const closed = makeCandleSlices(1000 * HOUR_MS, [
      180,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    expect(isEntryBandCandidate({ closed })).toBe(false);
  });

  it("returns false when highest close is outside entry band", () => {
    const closed = makeCandleSlices(1000 * HOUR_MS, [
      130,
      190,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    expect(isEntryBandCandidate({ closed })).toBe(false);
  });
});
