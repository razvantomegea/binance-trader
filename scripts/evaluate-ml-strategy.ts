#!/usr/bin/env node

import { readdir } from "node:fs/promises";

import {
  BINANCE_FETCH_CONCURRENCY,
  INITIAL_PAPER_CASH,
} from "@/constants/binance";
import {
  ML_DEFAULT_FEE_BPS,
  ML_MODEL_THRESHOLDS,
} from "@/constants/ml-strategy";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import {
  STRATEGY_INTERVAL,
  STRATEGY_LOOKBACK_CLOSES,
} from "@/constants/strategy";
import {
  createDefaultBacktestConfig,
  evaluateStrategyCandidate,
  loadHistoricalKlinesBySymbol,
} from "@/helpers/ml/evaluate-strategy-candidate";
import { precomputeEntryProbabilities } from "@/helpers/ml/precompute-entry-probabilities";
import {
  minimumSimulationDurationMs,
  splitSimulationRanges,
} from "@/helpers/ml/sample-strategy-params";
import { loadTrainedModel } from "@/helpers/ml/train-logistic-model";
import { assertLocalhostOnly } from "@/helpers/strategy/backtest/assert-localhost-only";
import {
  getEvaluationStartOpenTime,
  getHistoricalRange,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import type { MlOptimizationCandidate } from "@/types/ml-strategy";
import { getMlModelsDir } from "@/utils/ml/ml-artifact-paths";
import { ensureTfCpuBackend } from "@/utils/ml/model-io";
import { parseMlBaseArgs, resolveSymbols } from "./ml/parse-ml-cli-args";

interface CliOptions {
  days: number;
  symbols?: string[];
  concurrency: number;
  modelRunId?: string;
  feeBps: number;
}

function parseArgs(argv: string[]): CliOptions {
  const baseOptions = parseMlBaseArgs(argv, {
    days: 180,
    concurrency: BINANCE_FETCH_CONCURRENCY,
    feeBps: ML_DEFAULT_FEE_BPS,
  });
  const options: CliOptions = { ...baseOptions };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--model-run-id" && next) {
      options.modelRunId = next;
      i += 1;
    }
  }

  return options;
}

async function resolveLatestModelRunId(): Promise<string> {
  const dir = getMlModelsDir();
  const runs = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const latest = runs[runs.length - 1];
  if (!latest) {
    throw new Error(`No model found in ${dir}. Run pnpm ml:train first.`);
  }
  return latest;
}

function printCandidate(
  label: string,
  candidate: MlOptimizationCandidate,
): void {
  const { metrics } = candidate;
  const gate =
    candidate.modelMinProbability === null
      ? "baseline"
      : `threshold=${candidate.modelMinProbability.toFixed(1)}`;
  console.log(
    `  ${label} [${gate}] riskAdj=${metrics.riskAdjustedScore.toFixed(2)} pnl=${metrics.pnlPct.toFixed(2)}% dd=${metrics.maxDrawdownPct.toFixed(2)}% winRate=${metrics.winRatePct.toFixed(1)}% trades=${metrics.totalTrades}`,
  );
}

interface EvaluationContext {
  symbols: string[];
  modelRunId: string;
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  baseConfig: ReturnType<typeof createDefaultBacktestConfig>;
  ranges: ReturnType<typeof splitSimulationRanges>;
}

function resolveSimulationRanges(days: number): {
  fetchStartTime: number;
  endTime: number;
  ranges: ReturnType<typeof splitSimulationRanges>;
} {
  const { startTime: fetchStartTime, endTime } = getHistoricalRange({
    days,
  });
  const simulationStartTime = getEvaluationStartOpenTime({
    rangeStartTime: fetchStartTime,
    lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
  });
  if (endTime - simulationStartTime < minimumSimulationDurationMs()) {
    throw new Error("Backtest range too short for train/validation/test splits.");
  }
  const ranges = splitSimulationRanges({
    startTime: simulationStartTime,
    endTime,
  });
  return { fetchStartTime, endTime, ranges };
}

async function buildEvaluationContext(options: CliOptions): Promise<EvaluationContext> {
  const modelRunId = options.modelRunId ?? (await resolveLatestModelRunId());
  const symbols = await resolveSymbols(options.symbols);
  const { fetchStartTime, endTime, ranges } = resolveSimulationRanges(options.days);
  console.log(
    `Evaluating ML strategy: model=${modelRunId}, symbols=${symbols.length}, days=${options.days}, feeBps=${options.feeBps}`,
  );
  const klinesBySymbol = await loadHistoricalKlinesBySymbol({
    symbols,
    interval: STRATEGY_INTERVAL,
    startTime: fetchStartTime,
    endTime,
    concurrency: options.concurrency,
  });
  const baseConfig = createDefaultBacktestConfig({
    days: options.days,
    initialCash: INITIAL_PAPER_CASH,
    concurrency: options.concurrency,
    feeBps: options.feeBps,
    symbols,
  });
  return { symbols, modelRunId, klinesBySymbol, baseConfig, ranges };
}

async function evaluateBaselines(params: {
  symbols: string[];
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  baseConfig: ReturnType<typeof createDefaultBacktestConfig>;
  ranges: ReturnType<typeof splitSimulationRanges>;
}): Promise<{ baselineValidation: MlOptimizationCandidate; baselineTest: MlOptimizationCandidate }> {
  const { symbols, klinesBySymbol, baseConfig, ranges } = params;
  const baselineValidation = await evaluateStrategyCandidate({
    strategyParams: DEFAULT_STRATEGY_PARAMS,
    split: "validation",
    range: ranges.validation,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProbability: null,
  });
  const baselineTest = await evaluateStrategyCandidate({
    strategyParams: DEFAULT_STRATEGY_PARAMS,
    split: "test",
    range: ranges.test,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProbability: null,
  });
  return { baselineValidation, baselineTest };
}

async function evaluateThresholds(params: {
  symbols: string[];
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  baseConfig: ReturnType<typeof createDefaultBacktestConfig>;
  ranges: ReturnType<typeof splitSimulationRanges>;
  entryProbabilityBySymbol: Map<string, Map<number, number>>;
}): Promise<MlOptimizationCandidate | null> {
  const { symbols, klinesBySymbol, baseConfig, ranges, entryProbabilityBySymbol } =
    params;
  let bestValidation: MlOptimizationCandidate | null = null;
  for (const threshold of ML_MODEL_THRESHOLDS) {
    const candidate = await evaluateStrategyCandidate({
      strategyParams: DEFAULT_STRATEGY_PARAMS,
      split: "validation",
      range: ranges.validation,
      symbols,
      klinesBySymbol,
      baseConfig,
      modelMinProbability: threshold,
      entryProbabilityBySymbol,
    });
    if (
      !bestValidation ||
      candidate.metrics.riskAdjustedScore > bestValidation.metrics.riskAdjustedScore
    ) {
      bestValidation = candidate;
    }
  }
  return bestValidation;
}

async function evaluateBestThresholdTest(params: {
  bestValidation: MlOptimizationCandidate | null;
  symbols: string[];
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  baseConfig: ReturnType<typeof createDefaultBacktestConfig>;
  ranges: ReturnType<typeof splitSimulationRanges>;
  entryProbabilityBySymbol: Map<string, Map<number, number>>;
}): Promise<MlOptimizationCandidate | null> {
  const {
    bestValidation,
    symbols,
    klinesBySymbol,
    baseConfig,
    ranges,
    entryProbabilityBySymbol,
  } = params;
  const threshold = bestValidation?.modelMinProbability;
  if (threshold === null || threshold === undefined) {
    return null;
  }
  return evaluateStrategyCandidate({
    strategyParams: DEFAULT_STRATEGY_PARAMS,
    split: "test",
    range: ranges.test,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProbability: threshold,
    entryProbabilityBySymbol,
  });
}

function printResults(params: {
  baselineValidation: MlOptimizationCandidate;
  bestValidation: MlOptimizationCandidate | null;
  baselineTest: MlOptimizationCandidate;
  bestTest: MlOptimizationCandidate | null;
}): void {
  const { baselineValidation, bestValidation, baselineTest, bestTest } = params;
  console.log("\nVALIDATION");
  printCandidate("baseline", baselineValidation);
  if (bestValidation) {
    printCandidate("best ML gate", bestValidation);
  }
  console.log("\nTEST (untouched)");
  printCandidate("baseline", baselineTest);
  if (bestTest) {
    printCandidate("best ML gate", bestTest);
  }
}

async function main(): Promise<void> {
  assertLocalhostOnly();
  await ensureTfCpuBackend();
  const options = parseArgs(process.argv.slice(2));
  const { symbols, modelRunId, klinesBySymbol, baseConfig, ranges } =
    await buildEvaluationContext(options);
  const { model, metadata } = await loadTrainedModel({ runId: modelRunId });
  console.log("Precomputing entry probabilities...");
  const entryProbabilityBySymbol = await precomputeEntryProbabilities({
    symbols,
    klinesBySymbol,
    model,
    metadata,
  });
  model.dispose();
  const { baselineValidation, baselineTest } = await evaluateBaselines({
    symbols,
    klinesBySymbol,
    baseConfig,
    ranges,
  });
  const bestValidation = await evaluateThresholds({
    symbols,
    klinesBySymbol,
    baseConfig,
    ranges,
    entryProbabilityBySymbol,
  });
  const bestTest = await evaluateBestThresholdTest({
    bestValidation,
    symbols,
    klinesBySymbol,
    baseConfig,
    ranges,
    entryProbabilityBySymbol,
  });
  printResults({ baselineValidation, bestValidation, baselineTest, bestTest });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
