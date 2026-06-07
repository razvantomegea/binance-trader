import { describe, expect, it } from "vitest";

import {
  ML_FORWARD_DRAWDOWN_CAP_PCT,
  ML_FORWARD_HORIZON_HOURS,
} from "@/constants/ml-strategy";
import type { KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";

import {
  buildForwardLabel,
  buildHourlySampleTimes,
  findClosedCandleIndexBeforeTime,
} from "./build-forward-label";

function makeKline(openTime: number, close: number, low = close): KlineCandle {
  return { openTime, open: close, high: close, low, close };
}

describe("buildForwardLabel", () => {
  const entryIndex = 0;
  const entryPrice = 100;
  const klinesAsc: KlineCandle[] = [
    makeKline(0, 100),
    makeKline(HOUR_MS, 110, 98),
    makeKline(2 * HOUR_MS, 115, 105),
  ];

  it("returns null for invalid entry index", () => {
    expect(
      buildForwardLabel({
        klinesAsc,
        entryCandleIndex: -1,
        entryPrice,
      }),
    ).toBeNull();
  });

  it("returns null when no future candles exist", () => {
    expect(
      buildForwardLabel({
        klinesAsc: [makeKline(0, 100)],
        entryCandleIndex: 0,
        entryPrice,
      }),
    ).toBeNull();
  });

  it("labels positive when forward return is positive and drawdown within cap", () => {
    const result = buildForwardLabel({
      klinesAsc,
      entryCandleIndex: entryIndex,
      entryPrice,
      horizonHours: ML_FORWARD_HORIZON_HOURS,
      forwardDrawdownCapPct: ML_FORWARD_DRAWDOWN_CAP_PCT,
    });

    expect(result?.label).toBe(1);
    expect(result?.labelMeta.forwardReturnPct).toBeGreaterThan(0);
    expect(result?.labelMeta.horizonHours).toBe(ML_FORWARD_HORIZON_HOURS);
  });

  it("labels negative when forward return is non-positive", () => {
    const declining: KlineCandle[] = [
      makeKline(0, 100),
      makeKline(HOUR_MS, 95, 94),
    ];

    const result = buildForwardLabel({
      klinesAsc: declining,
      entryCandleIndex: 0,
      entryPrice,
      horizonHours: 24,
    });

    expect(result?.label).toBe(0);
  });

  it("subtracts round-trip fees from forward return", () => {
    const flat: KlineCandle[] = [makeKline(0, 100), makeKline(HOUR_MS, 100)];

    const withoutFees = buildForwardLabel({
      klinesAsc: flat,
      entryCandleIndex: 0,
      entryPrice: 100,
      feeBps: 0,
    });
    const withFees = buildForwardLabel({
      klinesAsc: flat,
      entryCandleIndex: 0,
      entryPrice: 100,
      feeBps: 10,
    });

    expect(withFees!.labelMeta.forwardReturnPct).toBeLessThan(
      withoutFees!.labelMeta.forwardReturnPct,
    );
  });
});

describe("findClosedCandleIndexBeforeTime", () => {
  const klinesAsc = [
    makeKline(0, 100),
    makeKline(HOUR_MS, 101),
    makeKline(2 * HOUR_MS, 102),
  ];

  it("returns last closed candle index before target time", () => {
    expect(
      findClosedCandleIndexBeforeTime({
        klinesAsc,
        targetTime: 2 * HOUR_MS + 1,
      }),
    ).toBe(1);
  });

  it("returns -1 when no candle closes before target", () => {
    expect(
      findClosedCandleIndexBeforeTime({
        klinesAsc,
        targetTime: 0,
      }),
    ).toBe(-1);
  });
});

describe("buildHourlySampleTimes", () => {
  it("generates inclusive hourly sample times", () => {
    expect(
      buildHourlySampleTimes({
        startTime: 0,
        endTime: 2 * HOUR_MS,
        sampleEveryHours: 1,
      }),
    ).toEqual([0, HOUR_MS, 2 * HOUR_MS]);
  });
});
