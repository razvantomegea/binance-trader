import { describe, expect, it } from "vitest";

import {
  ML_TRAIN_FRACTION,
  ML_VALIDATION_FRACTION,
  STRATEGY_PARAM_BOUNDS,
} from "@/constants/ml-strategy";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import { HOUR_MS } from "@/utils/binance/candle-time";

import {
  createMulberry32,
  minimumSimulationDurationMs,
  sampleRandomStrategyParams,
  splitSimulationRanges,
} from "./sample-strategy-params";

describe("splitSimulationRanges", () => {
  it("splits timeline into train, validation, and test ranges", () => {
    const startTime = 0;
    const endTime = 10_000;

    const ranges = splitSimulationRanges({ startTime, endTime });

    expect(ranges.train.endTime).toBe(Math.floor(endTime * ML_TRAIN_FRACTION));
    expect(ranges.validation.startTime).toBe(ranges.train.endTime);
    expect(ranges.validation.endTime).toBe(
      Math.floor(endTime * (ML_TRAIN_FRACTION + ML_VALIDATION_FRACTION)),
    );
    expect(ranges.test.startTime).toBe(ranges.validation.endTime);
    expect(ranges.test.endTime).toBe(endTime);
  });
});

describe("createMulberry32", () => {
  it("produces deterministic values for same seed", () => {
    const rngA = createMulberry32(42);
    const rngB = createMulberry32(42);

    expect(rngA()).toBe(rngB());
    expect(rngA()).toBe(rngB());
  });

  it("returns values in [0, 1)", () => {
    const rng = createMulberry32(7);
    for (let i = 0; i < 20; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("sampleRandomStrategyParams", () => {
  it("samples params within configured bounds", () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    let index = 0;
    const rng = () => values[index++ % values.length]!;

    const params = sampleRandomStrategyParams(rng);

    expect(params.entryRangePct).toBeGreaterThanOrEqual(
      STRATEGY_PARAM_BOUNDS.entryRangePct.min,
    );
    expect(params.entryRangeMaxPct).toBeGreaterThan(params.entryRangePct);
    expect(params.buyNotionalPct).toBeGreaterThanOrEqual(
      STRATEGY_PARAM_BOUNDS.buyNotionalPct.min,
    );
    expect(params.trailingStopPct).toBeGreaterThanOrEqual(
      STRATEGY_PARAM_BOUNDS.trailingStopPct.min,
    );
    expect(params.maxLossPct).toBeGreaterThanOrEqual(
      STRATEGY_PARAM_BOUNDS.maxLossPct.min,
    );
    expect(params.symbolReentryCooldownMs).toBeDefined();
  });

  it("bumps entryRangeMaxPct when sampled max is not above min", () => {
    const params = sampleRandomStrategyParams(() => 0);

    expect(params.entryRangeMaxPct).toBeGreaterThan(params.entryRangePct);
  });

  it("falls back to default cooldown when rng index is out of range", () => {
    const params = sampleRandomStrategyParams(() => 1);

    expect(params.symbolReentryCooldownMs).toBe(
      DEFAULT_STRATEGY_PARAMS.symbolReentryCooldownMs,
    );
  });
});

describe("minimumSimulationDurationMs", () => {
  it("requires at least 48 hours", () => {
    expect(minimumSimulationDurationMs()).toBe(48 * HOUR_MS);
  });
});
