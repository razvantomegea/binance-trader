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
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";
import { parseCliNumber } from "./ml-cli-args";

interface CliOptions {
  days: number;
  symbols?: string[];
  concurrency: number;
  modelRunId?: string;
  feeBps: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    days: 180,
    concurrency: BINANCE_FETCH_CONCURRENCY,
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
    } else if (arg === "--model-run-id" && next) {
      options.modelRunId = next;
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

async function main(): Promise<void> {
  assertLocalhostOnly();
  await ensureTfCpuBackend();
  const options = parseArgs(process.argv.slice(2));
  const modelRunId = options.modelRunId ?? (await resolveLatestModelRunId());
  const symbols = await resolveSymbols(options.symbols);

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

  const { model, metadata } = await loadTrainedModel({ runId: modelRunId });
  console.log("Precomputing entry probabilities...");
  const entryProbabilityBySymbol = await precomputeEntryProbabilities({
    symbols,
    klinesBySymbol,
    model,
    metadata,
  });
  model.dispose();

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
      candidate.metrics.riskAdjustedScore >
        bestValidation.metrics.riskAdjustedScore
    ) {
      bestValidation = candidate;
    }
  }

  let bestTest: MlOptimizationCandidate | null = null;
  if (bestValidation && bestValidation.modelMinProbability !== null) {
    bestTest = await evaluateStrategyCandidate({
      strategyParams: DEFAULT_STRATEGY_PARAMS,
      split: "test",
      range: ranges.test,
      symbols,
      klinesBySymbol,
      baseConfig,
      modelMinProbability: bestValidation.modelMinProbability,
      entryProbabilityBySymbol,
    });
  }

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
