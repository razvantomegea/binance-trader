#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import {
  createDefaultBacktestConfig,
  runBacktest,
} from "@/helpers/strategy/backtest-runner";

interface CliOptions {
  days: number;
  initialCash: number;
  concurrency: number;
  feeBps: number;
  checkEveryMinutes: number;
  symbols?: string[];
  output?: string;
}

function parseFiniteNumberArg(flag: string, value: string | undefined): number {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.startsWith("--")
  ) {
    throw new Error(`Missing value for ${flag}`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }

  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    days: 365,
    initialCash: 10_000,
    concurrency: BINANCE_FETCH_CONCURRENCY,
    feeBps: 0,
    checkEveryMinutes: 15,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--days":
        options.days = parseFiniteNumberArg("--days", next);
        i += 1;
        break;
      case "--cash":
        options.initialCash = parseFiniteNumberArg("--cash", next);
        i += 1;
        break;
      case "--concurrency":
        options.concurrency = parseFiniteNumberArg("--concurrency", next);
        i += 1;
        break;
      case "--fee-bps":
        options.feeBps = parseFiniteNumberArg("--fee-bps", next);
        i += 1;
        break;
      case "--check-every-minutes":
        options.checkEveryMinutes = parseFiniteNumberArg(
          "--check-every-minutes",
          next,
        );
        i += 1;
        break;
      case "--symbols":
        options.symbols = next
          ?.split(/[,\s]+/)
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean);
        i += 1;
        break;
      case "--output":
        options.output = next;
        i += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = createDefaultBacktestConfig({
    days: options.days,
    initialCash: options.initialCash,
    concurrency: options.concurrency,
    feeBps: options.feeBps,
    checkEveryMinutes: options.checkEveryMinutes,
    symbols: options.symbols,
  });

  console.log(
    `Running backtest: days=${config.days}, cash=${config.initialCash}, concurrency=${config.concurrency}, checkEveryMinutes=${config.checkEveryMinutes}, symbols=${config.symbols?.length ?? "ALL_TRADING"}`,
  );

  const report = await runBacktest(config);

  console.log("Backtest complete");
  console.log(`PnL: ${report.pnlPct.toFixed(2)}%`);
  console.log(`Max drawdown: ${report.maxDrawdownPct.toFixed(2)}%`);
  console.log(`Win rate: ${report.winRatePct.toFixed(2)}%`);
  console.log(`Trades: ${report.totalTrades}`);

  const outputPath =
    options.output ??
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "backtest-results",
      `backtest-${Date.now()}.json`,
    );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Report saved: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
