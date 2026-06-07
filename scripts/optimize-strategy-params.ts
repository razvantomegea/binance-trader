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
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";
import { parseCliNumber } from "./ml-cli-args";

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

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    days: 180,
    concurrency: BINANCE_FETCH_CONCURRENCY,
    trials: ML_OPTIMIZER_RANDOM_TRIALS,
    feeBps: ML_DEFAULT_FEE_BPS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--days" && next) {
      options.days = parseCliNumber({
        flag: "--days",
        value: next,
        integer: true,
        min: 1,
      });
      i += 1;
    } else if (arg === "--symbols" && next) {
      options.symbols = next
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
    } else if (arg === "--concurrency" && next) {
      options.concurrency = parseCliNumber({
        flag: "--concurrency",
        value: next,
        integer: true,
        min: 1,
      });
      i += 1;
    } else if (arg === "--trials" && next) {
      options.trials = parseCliNumber({
        flag: "--trials",
        value: next,
        integer: true,
        min: 0,
      });
      i += 1;
    } else if (arg === "--run-id" && next) {
      options.runId = next;
      i += 1;
    } else if (arg === "--seed" && next) {
      options.seed = parseCliNumber({
        flag: "--seed",
        value: next,
        integer: true,
        min: 0,
      });
      i += 1;
    } else if (arg === "--model-run-id" && next) {
      options.modelRunId = next;
      i += 1;
    } else if (arg === "--model-min-prob" && next) {
      options.modelMinProb = parseCliNumber({
        flag: "--model-min-prob",
        value: next,
        min: 0,
        max: 1,
      });
      i += 1;
    } else if (arg === "--fee-bps" && next) {
      options.feeBps = parseCliNumber({
        flag: "--fee-bps",
        value: next,
        min: 0,
      });
      i += 1;
    }
  }

  return options;
}

async function resolveSymbols(symbols?: string[]): Promise<string[]> {
  if (symbols && symbols.length > 0) {
    return [...new Set(symbols)].sort();
  }
  return [...(await getTradingSymbols())].sort();
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

async function main(): Promise<void> {
  assertLocalhostOnly();
  const options = parseArgs(process.argv.slice(2));

  if (options.modelMinProb !== undefined && !options.modelRunId) {
    throw new Error("--model-min-prob requires --model-run-id");
  }
  if (options.modelRunId && options.modelMinProb === undefined) {
    throw new Error("--model-run-id requires --model-min-prob");
  }

  const runId = options.runId ?? `optimize-${Date.now()}`;
  const symbols = await resolveSymbols(options.symbols);
  const rng =
    options.seed !== undefined ? createMulberry32(options.seed) : Math.random;

  const { startTime: fetchStartTime, endTime } = getHistoricalRange({
    days: options.days,
  });

  const simulationStartTime = getEvaluationStartOpenTime({
    rangeStartTime: fetchStartTime,
    lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
  });

  if (endTime - simulationStartTime < minimumSimulationDurationMs()) {
    throw new Error(
      "Backtest range too short for train/validation/test splits.",
    );
  }

  const ranges = splitSimulationRanges({
    startTime: simulationStartTime,
    endTime,
  });

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

  let entryProbabilityBySymbol: Map<string, Map<number, number>> | undefined;
  if (options.modelRunId) {
    await ensureTfCpuBackend();
    const { model, metadata } = await loadTrainedModel({
      runId: options.modelRunId,
    });
    console.log(
      `Precomputing entry probabilities from model ${options.modelRunId}...`,
    );
    entryProbabilityBySymbol = await precomputeEntryProbabilities({
      symbols,
      klinesBySymbol,
      model,
      metadata,
    });
    model.dispose();
    console.log(
      `Model gate enabled: minProb=${options.modelMinProb ?? "none (baseline only)"}`,
    );
  }

  const baseConfig = createDefaultBacktestConfig({
    days: options.days,
    initialCash: INITIAL_PAPER_CASH,
    concurrency: options.concurrency,
    feeBps: options.feeBps,
    symbols,
  });

  const candidates = uniqueCandidates([
    DEFAULT_STRATEGY_PARAMS,
    ...Array.from({ length: options.trials }, () =>
      sampleRandomStrategyParams(rng),
    ),
  ]);

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
      modelMinProbability: options.modelMinProb ?? null,
      entryProbabilityBySymbol,
    });

    validationResults.push(validation);
    console.log(
      `  validation riskAdj=${validation.metrics.riskAdjustedScore.toFixed(2)} pnl=${validation.metrics.pnlPct.toFixed(2)}% dd=${validation.metrics.maxDrawdownPct.toFixed(2)}%`,
    );
  }

  validationResults.sort(
    (a, b) => b.metrics.riskAdjustedScore - a.metrics.riskAdjustedScore,
  );

  const bestValidation = validationResults[0] ?? null;
  let bestTest: MlOptimizationCandidate | null = null;

  if (bestValidation) {
    bestTest = await evaluateStrategyCandidate({
      strategyParams: bestValidation.strategyParams,
      split: "test",
      range: ranges.test,
      symbols,
      klinesBySymbol,
      baseConfig,
      modelMinProbability: options.modelMinProb ?? null,
      entryProbabilityBySymbol,
    });

    console.log("\nBest validation candidate:");
    console.log(JSON.stringify(bestValidation.strategyParams, null, 2));
    console.log(
      `Validation score=${bestValidation.metrics.riskAdjustedScore.toFixed(2)}`,
    );
    console.log(
      `Test score=${bestTest.metrics.riskAdjustedScore.toFixed(2)} pnl=${bestTest.metrics.pnlPct.toFixed(2)}% dd=${bestTest.metrics.maxDrawdownPct.toFixed(2)}%`,
    );
  }

  const run: MlOptimizationRun = {
    runId,
    createdAtIso: new Date().toISOString(),
    candidates: validationResults,
    bestValidation,
    bestTest,
  };

  const outputPath = getMlOptimizationRunPath(runId);
  await mkdir(getMlRunsDir(), { recursive: true });
  await writeFile(outputPath, JSON.stringify(run, null, 2), "utf8");
  console.log(`Optimization run saved: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
