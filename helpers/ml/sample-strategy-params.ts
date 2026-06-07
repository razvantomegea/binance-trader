import {
  ML_TRAIN_FRACTION,
  ML_VALIDATION_FRACTION,
  STRATEGY_PARAM_BOUNDS,
  SYMBOL_REENTRY_COOLDOWN_OPTIONS_MS,
} from "@/constants/ml-strategy";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import type { StrategyParams } from "@/types/strategy-params";
import { HOUR_MS } from "@/utils/binance/candle-time";

export interface SimulationTimeRange {
  startTime: number;
  endTime: number;
}

export interface SplitSimulationRanges {
  train: SimulationTimeRange;
  validation: SimulationTimeRange;
  test: SimulationTimeRange;
}

function rangeFromFraction(params: {
  startTime: number;
  endTime: number;
  fractionStart: number;
  fractionEnd: number;
}): SimulationTimeRange {
  const totalMs = params.endTime - params.startTime;
  return {
    startTime: Math.floor(params.startTime + totalMs * params.fractionStart),
    endTime: Math.floor(params.startTime + totalMs * params.fractionEnd),
  };
}

export function splitSimulationRanges(params: {
  startTime: number;
  endTime: number;
}): SplitSimulationRanges {
  return {
    train: rangeFromFraction({
      startTime: params.startTime,
      endTime: params.endTime,
      fractionStart: 0,
      fractionEnd: ML_TRAIN_FRACTION,
    }),
    validation: rangeFromFraction({
      startTime: params.startTime,
      endTime: params.endTime,
      fractionStart: ML_TRAIN_FRACTION,
      fractionEnd: ML_TRAIN_FRACTION + ML_VALIDATION_FRACTION,
    }),
    test: rangeFromFraction({
      startTime: params.startTime,
      endTime: params.endTime,
      fractionStart: ML_TRAIN_FRACTION + ML_VALIDATION_FRACTION,
      fractionEnd: 1,
    }),
  };
}

export function createMulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleFromBounds(
  bounds: { min: number; max: number; step: number },
  rng: () => number,
): number {
  const steps = Math.floor((bounds.max - bounds.min) / bounds.step);
  const index = Math.floor(rng() * (steps + 1));
  return Number((bounds.min + index * bounds.step).toFixed(6));
}

export function sampleRandomStrategyParams(
  rng: () => number = Math.random,
): StrategyParams {
  const entryRangePct = sampleFromBounds(
    STRATEGY_PARAM_BOUNDS.entryRangePct,
    rng,
  );
  let entryRangeMaxPct = sampleFromBounds(
    STRATEGY_PARAM_BOUNDS.entryRangeMaxPct,
    rng,
  );

  if (entryRangeMaxPct <= entryRangePct) {
    entryRangeMaxPct = Math.min(
      entryRangePct + STRATEGY_PARAM_BOUNDS.entryRangeMaxPct.step,
      STRATEGY_PARAM_BOUNDS.entryRangeMaxPct.max,
    );
  }

  const cooldownIndex = Math.floor(
    rng() * SYMBOL_REENTRY_COOLDOWN_OPTIONS_MS.length,
  );

  return {
    entryRangePct,
    entryRangeMaxPct,
    buyNotionalPct: sampleFromBounds(STRATEGY_PARAM_BOUNDS.buyNotionalPct, rng),
    trailingStopPct: sampleFromBounds(
      STRATEGY_PARAM_BOUNDS.trailingStopPct,
      rng,
    ),
    maxLossPct: sampleFromBounds(STRATEGY_PARAM_BOUNDS.maxLossPct, rng),
    symbolReentryCooldownMs:
      SYMBOL_REENTRY_COOLDOWN_OPTIONS_MS[cooldownIndex] ??
      DEFAULT_STRATEGY_PARAMS.symbolReentryCooldownMs,
  };
}

export function minimumSimulationDurationMs(): number {
  return 48 * HOUR_MS;
}
