import type { MlHorizonHours } from "@/types/ml-strategy";
import type { StrategyParams } from "@/types/strategy-params";

export const ML_FORWARD_HORIZON_HOURS: MlHorizonHours = 24;

/** Max forward drawdown from entry for positive label. */
export const ML_FORWARD_DRAWDOWN_CAP_PCT = 0.15;

/** riskAdjustedScore = pnlPct - ML_DRAWDOWN_PENALTY * maxDrawdownPct */
export const ML_DRAWDOWN_PENALTY = 2;

export const ML_TRAIN_FRACTION = 0.6;
export const ML_VALIDATION_FRACTION = 0.2;

export const ML_DATASET_SAMPLE_EVERY_HOURS = 1;

export const ML_DEFAULT_EPOCHS = 50;
export const ML_DEFAULT_BATCH_SIZE = 64;
export const ML_DEFAULT_LEARNING_RATE = 0.01;

export const ML_MODEL_THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7] as const;

export interface StrategyParamBounds {
  min: number;
  max: number;
  step: number;
}

export const STRATEGY_PARAM_BOUNDS: Record<
  keyof Omit<StrategyParams, "symbolReentryCooldownMs">,
  StrategyParamBounds
> = {
  entryRangePct: { min: 0.3, max: 0.5, step: 0.05 },
  entryRangeMaxPct: { min: 0.5, max: 0.8, step: 0.05 },
  buyNotionalPct: { min: 0.03, max: 0.1, step: 0.01 },
  trailingStopPct: { min: 0.15, max: 0.35, step: 0.05 },
  maxLossPct: { min: 0.1, max: 0.2, step: 0.025 },
};

export const SYMBOL_REENTRY_COOLDOWN_OPTIONS_MS = [
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  48 * 60 * 60 * 1000,
] as const;

export const ML_OPTIMIZER_RANDOM_TRIALS = 24;

/** Binance spot taker fee per side (0.1%) for ML labels/backtests. */
export const ML_DEFAULT_FEE_BPS = 10;
