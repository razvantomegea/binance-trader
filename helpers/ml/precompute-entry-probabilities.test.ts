import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";

const mockTensor2d = vi.fn();
const mockPredict = vi.fn();

vi.mock("@tensorflow/tfjs", () => ({
  tensor2d: (...args: unknown[]) => mockTensor2d(...args),
}));

import { precomputeEntryProbabilities } from "./precompute-entry-probabilities";

function makeKlines(count: number): KlineCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    openTime: i * HOUR_MS,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 100 + i,
  }));
}

const metadata = {
  runId: "run-1",
  createdAtIso: "2024-01-01T00:00:00.000Z",
  normalization: {
    featureNames: [
      "closeGainVsLowClose",
      "closeLossVsHighClose",
      "bandWidthPct",
      "closePositionInBand",
      "recentRangePct",
      "momentum1",
      "momentum3",
      "momentum6",
      "volatility3",
      "volatility6",
      "volumeProxy",
      "hourOfDayUtc",
    ],
    means: Array(12).fill(0),
    stds: Array(12).fill(1),
  },
  horizonHours: 24 as const,
  forwardDrawdownCapPct: 5,
  epochs: 1,
  trainRowCount: 10,
  validationRowCount: 2,
};

describe("precomputeEntryProbabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const inputTensor = { dispose: vi.fn() };
    const outputTensor = {
      data: vi.fn().mockResolvedValue(Float32Array.from([0.2, 0.8, 0.5])),
      dispose: vi.fn(),
    };
    mockTensor2d.mockReturnValue(inputTensor);
    mockPredict.mockReturnValue(outputTensor);
  });

  it("skips symbols with insufficient klines", async () => {
    const model = { predict: mockPredict };

    const result = await precomputeEntryProbabilities({
      symbols: ["SHORTUSDT"],
      klinesBySymbol: new Map([["SHORTUSDT", makeKlines(5)]]),
      model: model as never,
      metadata,
    });

    expect(result.size).toBe(0);
    expect(mockPredict).not.toHaveBeenCalled();
  });

  it("skips symbols missing from klinesBySymbol", async () => {
    const model = { predict: mockPredict };

    const result = await precomputeEntryProbabilities({
      symbols: ["MISSINGUSDT"],
      klinesBySymbol: new Map(),
      model: model as never,
      metadata,
    });

    expect(result.size).toBe(0);
    expect(mockPredict).not.toHaveBeenCalled();
  });

  it("defaults missing probability outputs to zero", async () => {
    const klines = makeKlines(STRATEGY_LOOKBACK_CLOSES + 2);
    const model = { predict: mockPredict };
    const outputTensor = {
      data: vi.fn().mockResolvedValue(Float32Array.from([0.4])),
      dispose: vi.fn(),
    };
    mockPredict.mockReturnValue(outputTensor);

    const result = await precomputeEntryProbabilities({
      symbols: ["BTCUSDT"],
      klinesBySymbol: new Map([["BTCUSDT", klines]]),
      model: model as never,
      metadata,
    });

    const bySymbol = result.get("BTCUSDT");
    expect(
      bySymbol?.get(klines[STRATEGY_LOOKBACK_CLOSES - 1]!.openTime),
    ).toBeCloseTo(0.4);
    expect(bySymbol?.get(klines[STRATEGY_LOOKBACK_CLOSES]!.openTime)).toBe(0);
  });

  it("returns probabilities keyed by symbol and openTime", async () => {
    const klines = makeKlines(STRATEGY_LOOKBACK_CLOSES + 2);
    const model = { predict: mockPredict };

    const result = await precomputeEntryProbabilities({
      symbols: ["BTCUSDT"],
      klinesBySymbol: new Map([["BTCUSDT", klines]]),
      model: model as never,
      metadata,
    });

    const bySymbol = result.get("BTCUSDT");
    expect(bySymbol).toBeDefined();
    expect(bySymbol?.size).toBeGreaterThan(0);
    expect(mockTensor2d).toHaveBeenCalled();
    expect(mockPredict).toHaveBeenCalled();
  });
});
