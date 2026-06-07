#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";

import {
  BINANCE_FETCH_CONCURRENCY,
  INITIAL_PAPER_CASH,
} from "@/constants/binance";
import {
  ML_DEFAULT_FEE_BPS,
  ML_OPTIMIZER_RANDOM_TRIALS,
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
  createMulberry32,
  minimumSimulationDurationMs,
  sampleRandomStrategyParams,
  splitSimulationRanges,
} from "@/helpers/ml/sample-strategy-params";
import { loadTrainedModel } from "@/helpers/ml/train-logistic-model";
import { assertLocalhostOnly } from "@/helpers/strategy/backtest/assert-localhost-only";
import {
  getEvaluationStartOpenTime,
  getHistoricalRange,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import type {
  MlOptimizationCandidate,
  MlOptimizationRun,
} from "@/types/ml-strategy";
import type { StrategyParams } from "@/types/strategy-params";
import {
  getMlOptimizationRunPath,
  getMlRunsDir,
} from "@/utils/ml/ml-artifact-paths";
import { ensureTfCpuBackend } from "@/utils/ml/model-io";
import {
  parseCliNumber,
  parseMlBaseArgs,
  resolveSymbols,
} from "./ml/parse-ml-cli-args";

interface CliOptions {
  days: number;
  symbols?: string[];
  concurrency: number;
  trials: number;
  runId?: string;
  seed?: number;
  modelRunId?: string;
  modelMinProb?: number;
  feeBps: number;
}

function applyExtraArg(
  options: CliOptions,
  arg: string,
  next: string | undefined,
): boolean {
  if (!next) {
    return false;
  }
  switch (arg) {
    case "--trials":
      options.trials = parseCliNumber({
        flag: "--trials",
        value: next,
        integer: true,
        min: 0,
      });
      return true;
    case "--run-id":
      options.runId = next;
      return true;
    case "--seed":
      options.seed = parseCliNumber({
        flag: "--seed",
        value: next,
        integer: true,
        min: 0,
      });
      return true;
    case "--model-run-id":
      options.modelRunId = next;
      return true;
    case "--model-min-prob":
      options.modelMinProb = parseCliNumber({
        flag: "--model-min-prob",
        value: next,
        min: 0,
        max: 1,
      });
      return true;
    default:
      return false;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const baseOptions = parseMlBaseArgs(argv, {
    days: 180,
    concurrency: BINANCE_FETCH_CONCURRENCY,
    feeBps: ML_DEFAULT_FEE_BPS,
  });
  const options: CliOptions = {
    ...baseOptions,
    trials: ML_OPTIMIZER_RANDOM_TRIALS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (applyExtraArg(options, arg, next)) {
      i += 1;
    }
  }

  return options;
}

function uniqueCandidates(candidates: StrategyParams[]): StrategyParams[] {
  const seen = new Set<string>();
  const unique: StrategyParams[] = [];

  for (const candidate of candidates) {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

function assertModelGateArgs(options: CliOptions): void {
  if (options.modelMinProb !== undefined && !options.modelRunId) {
    throw new Error("--model-min-prob requires --model-run-id");
  }
  if (options.modelRunId && options.modelMinProb === undefined) {
    throw new Error("--model-run-id requires --model-min-prob");
  }
}

function createRandomSource(seed?: number): () => number {
  return seed !== undefined ? createMulberry32(seed) : Math.random;
}

interface SimulationRangeContext {
  fetchStartTime: number;
  endTime: number;
  ranges: ReturnType<typeof splitSimulationRanges>;
}

function resolveSimulationRanges(days: number): SimulationRangeContext {
  const { startTime: fetchStartTime, endTime } = getHistoricalRange({ days });
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

async function loadOptionalEntryProbabilities(params: {
  modelRunId?: string;
  symbols: string[];
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  modelMinProb?: number;
}): Promise<Map<string, Map<number, number>> | undefined> {
  const { modelRunId, symbols, klinesBySymbol, modelMinProb } = params;
  if (!modelRunId) {
    return undefined;
  }
  await ensureTfCpuBackend();
  const { model, metadata } = await loadTrainedModel({ runId: modelRunId });
  console.log(`Precomputing entry probabilities from model ${modelRunId}...`);
  const probabilities = await precomputeEntryProbabilities({
    symbols,
    klinesBySymbol,
    model,
    metadata,
  });
  model.dispose();
  console.log(
    `Model gate enabled: minProb=${modelMinProb ?? "none (baseline only)"}`,
  );
  return probabilities;
}

async function evaluateCandidates(params: {
  candidates: StrategyParams[];
  ranges: ReturnType<typeof splitSimulationRanges>;
  symbols: string[];
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  baseConfig: ReturnType<typeof createDefaultBacktestConfig>;
  modelMinProb?: number;
  entryProbabilityBySymbol?: Map<string, Map<number, number>>;
}): Promise<MlOptimizationCandidate[]> {
  const {
    candidates,
    ranges,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProb,
    entryProbabilityBySymbol,
  } = params;
  const validationResults: MlOptimizationCandidate[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const strategyParams = candidates[i]!;
    console.log(
      `Trial ${i + 1}/${candidates.length}: entry=${strategyParams.entryRangePct}-${strategyParams.entryRangeMaxPct}, trail=${strategyParams.trailingStopPct}, maxLoss=${strategyParams.maxLossPct}`,
    );
    const validation = await evaluateStrategyCandidate({
      strategyParams,
      split: "validation",
      range: ranges.validation,
      symbols,
      klinesBySymbol,
      baseConfig,
      modelMinProbability: modelMinProb ?? null,
      entryProbabilityBySymbol,
    });
    validationResults.push(validation);
    console.log(
      `  validation riskAdj=${validation.metrics.riskAdjustedScore.toFixed(2)} pnl=${validation.metrics.pnlPct.toFixed(2)}% dd=${validation.metrics.maxDrawdownPct.toFixed(2)}%`,
    );
  }
  return validationResults;
}

async function evaluateBestTestCandidate(params: {
  bestValidation: MlOptimizationCandidate | null;
  ranges: ReturnType<typeof splitSimulationRanges>;
  symbols: string[];
  klinesBySymbol: Awaited<ReturnType<typeof loadHistoricalKlinesBySymbol>>;
  baseConfig: ReturnType<typeof createDefaultBacktestConfig>;
  modelMinProb?: number;
  entryProbabilityBySymbol?: Map<string, Map<number, number>>;
}): Promise<MlOptimizationCandidate | null> {
  const {
    bestValidation,
    ranges,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProb,
    entryProbabilityBySymbol,
  } = params;
  if (!bestValidation) {
    return null;
  }
  const bestTest = await evaluateStrategyCandidate({
    strategyParams: bestValidation.strategyParams,
    split: "test",
    range: ranges.test,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProbability: modelMinProb ?? null,
    entryProbabilityBySymbol,
  });
  console.log("\nBest validation candidate:");
  console.log(JSON.stringify(bestValidation.strategyParams, null, 2));
  console.log(`Validation score=${bestValidation.metrics.riskAdjustedScore.toFixed(2)}`);
  console.log(
    `Test score=${bestTest.metrics.riskAdjustedScore.toFixed(2)} pnl=${bestTest.metrics.pnlPct.toFixed(2)}% dd=${bestTest.metrics.maxDrawdownPct.toFixed(2)}%`,
  );
  return bestTest;
}

async function saveOptimizationRun(run: MlOptimizationRun): Promise<string> {
  const outputPath = getMlOptimizationRunPath(run.runId);
  await mkdir(getMlRunsDir(), { recursive: true });
  await writeFile(outputPath, JSON.stringify(run, null, 2), "utf8");
  return outputPath;
}

function createBaseConfig(params: {
  options: CliOptions;
  symbols: string[];
}): ReturnType<typeof createDefaultBacktestConfig> {
  const { options, symbols } = params;
  return createDefaultBacktestConfig({
    days: options.days,
    initialCash: INITIAL_PAPER_CASH,
    concurrency: options.concurrency,
    feeBps: options.feeBps,
    symbols,
  });
}

async function runOptimization(options: CliOptions): Promise<MlOptimizationRun> {
  const symbols = await resolveSymbols(options.symbols);
  const rng = createRandomSource(options.seed);
  const { fetchStartTime, endTime, ranges } = resolveSimulationRanges(options.days);
  console.log(
    `Optimizing strategy params: symbols=${symbols.length}, days=${options.days}, trials=${options.trials}, feeBps=${options.feeBps}`,
  );
  const klinesBySymbol = await loadHistoricalKlinesBySymbol({
    symbols,
    interval: STRATEGY_INTERVAL,
    startTime: fetchStartTime,
    endTime,
    concurrency: options.concurrency,
  });
  const entryProbabilityBySymbol = await loadOptionalEntryProbabilities({
    modelRunId: options.modelRunId,
    symbols,
    klinesBySymbol,
    modelMinProb: options.modelMinProb,
  });
  const baseConfig = createBaseConfig({ options, symbols });
  const candidates = uniqueCandidates([
    DEFAULT_STRATEGY_PARAMS,
    ...Array.from({ length: options.trials }, () =>
      sampleRandomStrategyParams(rng),
    ),
  ]);
  const validationResults = await evaluateCandidates({
    candidates,
    ranges,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProb: options.modelMinProb,
    entryProbabilityBySymbol,
  });
  validationResults.sort(
    (a, b) => b.metrics.riskAdjustedScore - a.metrics.riskAdjustedScore,
  );
  const bestValidation = validationResults[0] ?? null;
  const bestTest = await evaluateBestTestCandidate({
    bestValidation,
    ranges,
    symbols,
    klinesBySymbol,
    baseConfig,
    modelMinProb: options.modelMinProb,
    entryProbabilityBySymbol,
  });
  return {
    runId: options.runId ?? `optimize-${Date.now()}`,
    createdAtIso: new Date().toISOString(),
    candidates: validationResults,
    bestValidation,
    bestTest,
  };
}

async function main(): Promise<void> {
  assertLocalhostOnly();
  const options = parseArgs(process.argv.slice(2));
  assertModelGateArgs(options);
  const run = await runOptimization(options);
  const outputPath = await saveOptimizationRun(run);
  console.log(`Optimization run saved: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
