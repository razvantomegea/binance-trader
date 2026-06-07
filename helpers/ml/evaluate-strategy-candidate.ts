import {
  createDefaultBacktestConfig,
  runBacktestWithPreloadedKlines,
} from "@/helpers/strategy/backtest-runner";
import { loadHistoricalKlinesBySymbol } from "@/helpers/strategy/backtest/historical-kline-provider";
import type { BacktestConfig } from "@/types/backtest";
import type { KlineCandle } from "@/types/binance";
import type { MlOptimizationCandidate } from "@/types/ml-strategy";
import type { StrategyParams } from "@/types/strategy-params";
import { metricsFromBacktestReport } from "@/utils/ml/compute-risk-adjusted-score";

export interface EvaluateStrategyCandidateParams {
  strategyParams: StrategyParams;
  split: "train" | "validation" | "test";
  range: { startTime: number; endTime: number };
  symbols: string[];
  klinesBySymbol: Map<string, KlineCandle[]>;
  baseConfig: BacktestConfig;
  modelMinProbability?: number | null;
  entryProbabilityBySymbol?: Map<string, Map<number, number>>;
}

export async function evaluateStrategyCandidate(
  params: EvaluateStrategyCandidateParams,
): Promise<MlOptimizationCandidate> {
  const report = await runBacktestWithPreloadedKlines({
    config: {
      ...params.baseConfig,
      strategyParams: params.strategyParams,
      modelMinProbability:
        params.modelMinProbability === null ||
        params.modelMinProbability === undefined
          ? undefined
          : params.modelMinProbability,
      entryProbabilityBySymbol: params.entryProbabilityBySymbol,
    },
    symbols: params.symbols,
    klinesBySymbol: params.klinesBySymbol,
    simulationStartTime: params.range.startTime,
    simulationEndTime: params.range.endTime,
  });

  return {
    strategyParams: params.strategyParams,
    modelMinProbability: params.modelMinProbability ?? null,
    metrics: metricsFromBacktestReport(report),
    split: params.split,
  };
}

export type { BacktestConfig };

export { createDefaultBacktestConfig, loadHistoricalKlinesBySymbol };
