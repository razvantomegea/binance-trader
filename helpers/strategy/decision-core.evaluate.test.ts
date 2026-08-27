import { describe, expect, it } from "vitest";

import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import {
  evaluateDecision,
  type CandleSlice,
  type DecisionPositionState,
  type EvaluateDecisionResult,
} from "@/helpers/strategy/decision-core";
import { type CandleSpec, makeCandleSlices } from "@/test/candle-fixtures";
import { HOUR_MS } from "@/utils/binance/candle-time";

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

function evaluateOpenPosition(params: {
  specs: CandleSpec[];
  hoursAfterBuy?: number;
  positionOverrides?: Partial<DecisionPositionState>;
}): EvaluateDecisionResult {
  const buyOpenTime = 1000 * HOUR_MS;
  const latestOpenTime = buyOpenTime + (params.hoursAfterBuy ?? 1) * HOUR_MS;
  return evaluateDecision({
    closed: makeCandleSlices(latestOpenTime, params.specs),
    position: position({
      buyOpenTime,
      buyPrice: 100,
      ...params.positionOverrides,
    }),
    cash: 10_000,
    lastProcessedOpenTime: null,
    lastSellOpenTime: null,
  });
}

function evaluateFlat(params: {
  specs: CandleSpec[];
  lastProcessedOpenTime?: number | null;
  lastSellOpenTime?: number | null;
  entryProbability?: number;
  modelMinProbability?: number;
}): EvaluateDecisionResult {
  const latestOpenTime = 1000 * HOUR_MS;
  return evaluateDecision({
    closed: makeCandleSlices(latestOpenTime, params.specs),
    position: undefined,
    cash: 10_000,
    lastProcessedOpenTime: params.lastProcessedOpenTime ?? null,
    lastSellOpenTime: params.lastSellOpenTime ?? null,
    entryProbability: params.entryProbability,
    modelMinProbability: params.modelMinProbability,
  });
}

const LOOKBACK_BASE = Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100);
const LOOKBACK_BASE_MINUS_ONE = Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100);

describe("evaluateDecision exits", () => {
  it("holds when price increases less than 50%", () => {
    const result = evaluateOpenPosition({
      specs: [149, ...LOOKBACK_BASE],
    });
    expect(result.action).toBe("HOLD");
  });

  it("holds when price increases exactly 50%", () => {
    const result = evaluateOpenPosition({
      specs: [150, ...LOOKBACK_BASE],
    });
    expect(result.action).toBe("HOLD");
  });

  it("drawdown exit when price falls 25% from peak", () => {
    const result = evaluateOpenPosition({
      specs: [150, 200, ...LOOKBACK_BASE_MINUS_ONE],
      hoursAfterBuy: 2,
      positionOverrides: { maxPriceAfterBuy: 200 },
    });

    expect(result.action).toBe("SELL");
    expect(result.reason).toBe("exit_trailing_0.25_vs_peak");
  });

  it("holds when price falls 15% from buy because stop is 25% trailing", () => {
    const result = evaluateOpenPosition({
      specs: [85, ...LOOKBACK_BASE],
    });
    expect(result.action).toBe("HOLD");
  });

  it("sells at stop price when low gaps below 25% but close recovers", () => {
    const result = evaluateOpenPosition({
      specs: [{ close: 90, high: 90, low: 60 }, ...LOOKBACK_BASE],
    });

    expect(result.action).toBe("SELL");
    expect(result.exitPrice).toBe(75);
    expect(result.reason).toBe("exit_trailing_0.25_vs_peak");
  });

  it("holds when price peaked at +5% and trailing stop not reached", () => {
    const result = evaluateOpenPosition({
      specs: [{ close: 100, high: 105, low: 100 }, ...LOOKBACK_BASE],
      positionOverrides: { maxPriceAfterBuy: 105 },
    });
    expect(result.action).toBe("HOLD");
  });
});

describe("evaluateDecision entry", () => {
  it("buys when close is within 25-50% band above lowest 24h close", () => {
    const result = evaluateFlat({ specs: [150, ...LOOKBACK_BASE] });
    expect(result.action).toBe("BUY");
    expect(result.reason).toBe("entry_band_0.25_0.5");
  });

  it("does not buy when 24h range is more than 100%", () => {
    const result = evaluateFlat({
      specs: [
        { close: 190, high: 200, low: 90 },
        { close: 200, high: 200, low: 90 },
        ...LOOKBACK_BASE_MINUS_ONE,
      ],
    });
    expect(result.action).toBe("HOLD");
  });

  it("does not buy when last SELL was within 24h", () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const result = evaluateFlat({
      specs: [150, ...LOOKBACK_BASE],
      lastSellOpenTime: latestOpenTime - SYMBOL_REENTRY_COOLDOWN_MS + HOUR_MS,
    });
    expect(result.action).toBe("HOLD");
  });

  it("does not buy when current close is above 50% above lowest close", () => {
    const result = evaluateFlat({ specs: [180, ...LOOKBACK_BASE] });
    expect(result.action).toBe("HOLD");
  });

  it("does not buy when highest close is above 50% above lowest close", () => {
    const result = evaluateFlat({
      specs: [160, 190, ...LOOKBACK_BASE_MINUS_ONE],
    });
    expect(result.action).toBe("HOLD");
  });

  it("buys when current and highest close are both within 25-50% band", () => {
    const result = evaluateFlat({
      specs: [130, 140, ...LOOKBACK_BASE_MINUS_ONE],
    });
    expect(result.action).toBe("BUY");
    expect(result.reason).toBe("entry_band_0.25_0.5");
  });
});

describe("evaluateDecision skip", () => {
  it("skips when candle already processed", () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const result = evaluateFlat({
      specs: [150, ...LOOKBACK_BASE],
      lastProcessedOpenTime: latestOpenTime,
    });
    expect(result.action).toBe("SKIP");
  });
});

describe("evaluateDecision modelMinProbability gate", () => {
  function entryReadyCandles(latestOpenTime = 1000 * HOUR_MS): CandleSlice[] {
    return makeCandleSlices(latestOpenTime, [150, ...LOOKBACK_BASE]);
  }

  it("buys without model gate when modelMinProbability is unset", () => {
    const result = evaluateDecision({
      closed: entryReadyCandles(),
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(result.action).toBe("BUY");
  });

  it("buys when entryProbability meets modelMinProbability", () => {
    const result = evaluateDecision({
      closed: entryReadyCandles(),
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
      entryProbability: 0.7,
      modelMinProbability: 0.5,
    });

    expect(result.action).toBe("BUY");
  });

  it("holds when entryProbability is below modelMinProbability", () => {
    const result = evaluateDecision({
      closed: entryReadyCandles(),
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
      entryProbability: 0.4,
      modelMinProbability: 0.5,
    });

    expect(result.action).toBe("HOLD");
  });

  it("holds when entryProbability is missing and modelMinProbability is set", () => {
    const result = evaluateDecision({
      closed: entryReadyCandles(),
      position: undefined,
      cash: 10_000,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
      modelMinProbability: 0.1,
    });

    expect(result.action).toBe("HOLD");
  });
});
