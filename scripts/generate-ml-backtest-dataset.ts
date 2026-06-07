#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import {
  STRATEGY_INTERVAL,
  STRATEGY_LOOKBACK_CLOSES,
} from "@/constants/strategy";
import { generateDatasetRowsForSymbol } from "@/helpers/ml/generate-dataset-rows";
import {
  getEvaluationStartOpenTime,
  getHistoricalRange,
  loadHistoricalKlinesBySymbol,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import { assertLocalhostOnly } from "@/helpers/strategy/backtest/assert-localhost-only";
import type { MlDecisionRow } from "@/types/ml-strategy";
import { getMlDatasetsDir } from "@/utils/ml/ml-artifact-paths";
import { writeJsonl } from "@/utils/ml/read-write-jsonl";
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";
import {
  ML_FORWARD_HORIZON_HOURS,
  ML_DEFAULT_FEE_BPS,
} from "@/constants/ml-strategy";
import { HOUR_MS } from "@/utils/binance/candle-time";

interface CliOptions {
  days: number;
  symbols?: string[];
  concurrency: number;
  feeBps: number;
  output?: string;
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
      options.days = Number(next);
      i += 1;
    } else if (arg === "--symbols" && next) {
      options.symbols = next
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
    } else if (arg === "--concurrency" && next) {
      options.concurrency = Number(next);
      i += 1;
    } else if (arg === "--fee-bps" && next) {
      options.feeBps = Number(next);
      i += 1;
    } else if (arg === "--output" && next) {
      options.output = next;
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

async function main(): Promise<void> {
  assertLocalhostOnly();
  const options = parseArgs(process.argv.slice(2));
  const symbols = await resolveSymbols(options.symbols);

  const { startTime: fetchStartTime, endTime } = getHistoricalRange({
    days: options.days,
  });

  const evalStartTime = getEvaluationStartOpenTime({
    rangeStartTime: fetchStartTime,
    lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
  });

  const labelEndTime = endTime - ML_FORWARD_HORIZON_HOURS * HOUR_MS;

  console.log(
    `Generating ML dataset: symbols=${symbols.length}, days=${options.days}, sampleRange=${new Date(evalStartTime).toISOString()}..${new Date(labelEndTime).toISOString()}`,
  );

  const klinesBySymbol = await loadHistoricalKlinesBySymbol({
    symbols,
    interval: STRATEGY_INTERVAL,
    startTime: fetchStartTime,
    endTime,
    concurrency: options.concurrency,
  });

  const rows: MlDecisionRow[] = [];

  for (const symbol of symbols) {
    const klinesAsc = klinesBySymbol.get(symbol);
    if (!klinesAsc || klinesAsc.length === 0) {
      continue;
    }

    const symbolRows = generateDatasetRowsForSymbol({
      symbol,
      klinesAsc,
      startTime: evalStartTime,
      endTime: labelEndTime,
      feeBps: options.feeBps,
    });

    rows.push(...symbolRows);
    console.log(`  ${symbol}: ${symbolRows.length} rows`);
  }

  rows.sort(
    (a, b) => a.openTime - b.openTime || a.symbol.localeCompare(b.symbol),
  );

  const outputPath =
    options.output ?? join(getMlDatasetsDir(), `dataset-${Date.now()}.jsonl`);

  await mkdir(getMlDatasetsDir(), { recursive: true });
  await writeJsonl(outputPath, rows);

  const positive = rows.filter((row) => row.label === 1).length;
  console.log(`Dataset saved: ${outputPath}`);
  console.log(
    `Rows: ${rows.length}, positive labels: ${positive} (${rows.length > 0 ? ((positive / rows.length) * 100).toFixed(2) : 0}%)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
