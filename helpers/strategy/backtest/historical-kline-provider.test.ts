import { describe, expect, it } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import {
  buildCheckTimeline,
  getClosedWindowAt,
  getEvaluationStartOpenTime,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import { HOUR_MS } from "@/utils/binance/candle-time";
import type { KlineCandle } from "@/types/binance";

function makeAscendingKlines(params: {
  startOpenTime: number;
  closes: number[];
}): KlineCandle[] {
  return params.closes.map((close, index) => ({
    openTime: params.startOpenTime + index * HOUR_MS,
    open: close,
    high: close,
    low: close,
    close,
  }));
}

describe("historical kline helpers", () => {
  it("builds closed window at target open time", () => {
    const klinesAsc = makeAscendingKlines({
      startOpenTime: 0,
      closes: Array.from({ length: 30 }, (_, i) => 100 + i),
    });

    const window = getClosedWindowAt({
      klinesAsc,
      targetTime: 24 * HOUR_MS,
      count: STRATEGY_LOOKBACK_CLOSES,
    });

    expect(window).toHaveLength(STRATEGY_LOOKBACK_CLOSES);
    expect(window?.[0]?.openTime).toBe(23 * HOUR_MS);
    expect(window?.[23]?.openTime).toBe(0);
  });

  it("builds check timeline", () => {
    const timeline = buildCheckTimeline({
      startTime: 0,
      endTime: HOUR_MS,
      checkEveryMinutes: 15,
    });

    expect(timeline).toEqual([0, 900_000, 1_800_000, 2_700_000, HOUR_MS]);
  });

  it("computes evaluation start with lookback", () => {
    const start = getEvaluationStartOpenTime({
      rangeStartTime: 0,
      lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
    });

    expect(start).toBe((STRATEGY_LOOKBACK_CLOSES - 1) * HOUR_MS);
  });
});
