import { describe, expect, it } from "vitest";

import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import {
  evaluateDecision,
  type CandleSlice,
  type DecisionPositionState,
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

function position(
  overrides: Partial<DecisionPositionState> = {},
): DecisionPositionState {
  return {
    qty: 10,
    buyPrice: 100,
    maxPriceAfterBuy: 100,
    buyOpenTime: 1000 * HOUR_MS,
    ...overrides,
  };
}

describe("evaluateDecision exits", () => {
  it("no TP when price increases less than 50%", () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      149,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: position({ buyOpenTime, buyPrice: 100 }),
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("HOLD");
  });

  it("TP when price increases exactly 50%", () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: position({ buyOpenTime, buyPrice: 100 }),
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("SELL");
    expect(result.reason).toBe("take_profit_50pct_vs_buy");
  });

  it("drawdown exit when price falls 10% from peak", () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 2 * HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      170,
      200,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: position({
        buyOpenTime,
        buyPrice: 100,
        maxPriceAfterBuy: 200,
      }),
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("SELL");
    expect(result.reason).toBe("exit_drawdown_10pct_vs_peak");
  });

  it("break-even exit after price reached +5% and falls back to buy price", () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 2 * HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      100,
      105,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: position({
        buyOpenTime,
        buyPrice: 100,
        maxPriceAfterBuy: 105,
      }),
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("SELL");
    expect(result.reason).toBe("exit_drawdown_10pct_vs_peak");
  });
});

describe("evaluateDecision entry", () => {
  it("buys when 24h range >= 50% and current is within 10% of 24h high", () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("BUY");
    expect(result.reason).toBe("entry_24h_range_50pct_near_high");
  });

  it("does not buy when 24h range is more than 100%", () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      { close: 190, high: 200, low: 90 },
      { close: 200, high: 200, low: 90 },
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("HOLD");
  });

  it("does not buy when last SELL was within 24h", () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const lastSellOpenTime =
      latestOpenTime - SYMBOL_REENTRY_COOLDOWN_MS + HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime,
    });

    expect(result.action).toBe("HOLD");
  });
});

describe("evaluateDecision skip", () => {
  it("skips when candle already processed", () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const closed = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);

    const result = evaluateDecision({
      closed,
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: latestOpenTime,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("SKIP");
  });
});
