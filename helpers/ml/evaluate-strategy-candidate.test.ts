import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import { HOUR_MS } from "@/utils/binance/candle-time";
import type { KlineCandle } from "@/types/binance";

const mockRunBacktestWithPreloadedKlines = vi.fn();

vi.mock("@/helpers/strategy/backtest-runner", () => ({
  createDefaultBacktestConfig: (overrides = {}) => ({
    days: 30,
    initialCash: 10000,
    concurrency: 1,
    feeBps: 0,
    interval: "H1",
    ...overrides,
  }),
  runBacktestWithPreloadedKlines: (...args: unknown[]) =>
    mockRunBacktestWithPreloadedKlines(...args),
  loadHistoricalKlinesBySymbol: vi.fn(),
}));

import { evaluateStrategyCandidate } from "./evaluate-strategy-candidate";

function makeKlines(count: number): KlineCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    openTime: i * HOUR_MS,
    open: 100,
    high: 110,
    low: 90,
    close: 100,
  }));
}

describe("evaluateStrategyCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunBacktestWithPreloadedKlines.mockResolvedValue({
      startTime: 0,
      endTime: 10 * HOUR_MS,
      initialCash: 10000,
      finalEquity: 11000,
      pnlPct: 10,
      maxDrawdownPct: 2,
      winRatePct: 60,
      totalTrades: 5,
      winningTrades: 3,
      trades: [],
      equityCurve: [],
    });
  });

  it("runs backtest and returns optimization candidate metrics", async () => {
    const candidate = await evaluateStrategyCandidate({
      strategyParams: DEFAULT_STRATEGY_PARAMS,
      split: "validation",
      range: { startTime: 0, endTime: 10 * HOUR_MS },
      symbols: ["BTCUSDT"],
      klinesBySymbol: new Map([["BTCUSDT", makeKlines(50)]]),
      baseConfig: {
        days: 30,
        initialCash: 10000,
        concurrency: 1,
        feeBps: 0,
        interval: "H1",
      },
      modelMinProbability: 0.6,
    });

    expect(mockRunBacktestWithPreloadedKlines).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ["BTCUSDT"],
        simulationStartTime: 0,
        simulationEndTime: 10 * HOUR_MS,
      }),
    );
    expect(candidate.split).toBe("validation");
    expect(candidate.modelMinProbability).toBe(0.6);
    expect(candidate.metrics.pnlPct).toBe(10);
    expect(candidate.metrics.riskAdjustedScore).toBeTypeOf("number");
  });

  it("passes null modelMinProbability as undefined in config", async () => {
    await evaluateStrategyCandidate({
      strategyParams: DEFAULT_STRATEGY_PARAMS,
      split: "train",
      range: { startTime: 0, endTime: HOUR_MS },
      symbols: ["ETHUSDT"],
      klinesBySymbol: new Map([["ETHUSDT", makeKlines(30)]]),
      baseConfig: {
        days: 7,
        initialCash: 5000,
        concurrency: 1,
        feeBps: 5,
        interval: "H1",
      },
      modelMinProbability: null,
    });

    expect(mockRunBacktestWithPreloadedKlines).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          modelMinProbability: undefined,
        }),
      }),
    );
  });
});
