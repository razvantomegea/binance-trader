import {
  BINANCE_FETCH_CONCURRENCY,
  INITIAL_PAPER_CASH,
} from "@/constants/binance";
import {
  STRATEGY_INTERVAL,
  STRATEGY_LOOKBACK_CLOSES,
} from "@/constants/strategy";
import { assertLocalhostOnly } from "@/helpers/strategy/backtest/assert-localhost-only";
import { buildBacktestReport } from "@/helpers/strategy/backtest/build-backtest-report";
import {
  buildCheckTimeline,
  getClosedWindowAt,
  getEvaluationStartOpenTime,
  getHistoricalRange,
  loadHistoricalKlinesBySymbol,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import { SimulatedLedger } from "@/helpers/strategy/backtest/simulated-ledger";
import { evaluateDecision } from "@/helpers/strategy/decision-core";
import type {
  BacktestConfig,
  BacktestReport,
  EquityPoint,
} from "@/types/backtest";
import type { KlineCandle } from "@/types/binance";
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";
import { createAsyncMutex } from "@/utils/create-async-mutex";
import { processInBatches } from "@/utils/process-in-batches";

const DEFAULT_FEE_BPS = 0;
const PRELOAD_LOG_EVERY = 50;
export const BACKTEST_CHECK_EVERY_MINUTES = 60;

function normalizeAndValidateUsdtSymbols(symbols: string[]): string[] {
  const normalized = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length > 0 && normalized.length === 0) {
    throw new Error(
      "config.symbols must include at least one non-empty USDT symbol.",
    );
  }

  if (normalized.includes("USDT")) {
    throw new Error(
      'Invalid symbol "USDT" in config.symbols. Use market pairs like BTCUSDT.',
    );
  }

  const invalid = normalized.filter((symbol) => !symbol.endsWith("USDT"));
  if (invalid.length > 0) {
    throw new Error(
      `Only USDT symbols are allowed. Invalid: ${invalid.join(", ")}`,
    );
  }

  const deduped = [...new Set(normalized)].sort();
  if (deduped.length === 0) {
    throw new Error(
      "runBacktest requires at least one valid USDT symbol after normalization.",
    );
  }

  return deduped;
}

export function createDefaultBacktestConfig(
  overrides: Partial<BacktestConfig> = {},
): BacktestConfig {
  return {
    days: 365,
    initialCash: INITIAL_PAPER_CASH,
    concurrency: BINANCE_FETCH_CONCURRENCY,
    feeBps: DEFAULT_FEE_BPS,
    interval: STRATEGY_INTERVAL,
    ...overrides,
  };
}

async function resolveBacktestSymbols(
  config: BacktestConfig,
): Promise<string[]> {
  return config.symbols && config.symbols.length > 0
    ? normalizeAndValidateUsdtSymbols(config.symbols)
    : [...(await getTradingSymbols())].sort();
}

async function preloadHistoricalKlines(params: {
  symbols: string[];
  interval: BacktestConfig["interval"];
  startTime: number;
  endTime: number;
  concurrency: number;
}): Promise<Map<string, KlineCandle[]>> {
  console.log(
    `Phase 1: preloading ${params.symbols.length} symbols (concurrency=${params.concurrency})...`,
  );

  const klinesBySymbol = await loadHistoricalKlinesBySymbol({
    symbols: params.symbols,
    interval: params.interval,
    startTime: params.startTime,
    endTime: params.endTime,
    concurrency: params.concurrency,
    onSymbolLoaded: ({ loadedCount, totalCount }) => {
      if (
        loadedCount % PRELOAD_LOG_EVERY === 0 ||
        loadedCount === totalCount
      ) {
        console.log(`Preload progress: ${loadedCount}/${totalCount}`);
      }
    },
  });

  const withData = [...klinesBySymbol.values()].filter(
    (klines) => klines.length > 0,
  ).length;
  console.log(
    `Phase 1 complete: ${withData}/${params.symbols.length} symbols have klines.`,
  );

  return klinesBySymbol;
}

async function runBacktestSimulation(params: {
  symbols: string[];
  klinesBySymbol: Map<string, KlineCandle[]>;
  timeline: number[];
  initialCash: number;
  feeBps: number;
  concurrency: number;
}): Promise<{
  ledger: SimulatedLedger;
  equityCurve: EquityPoint[];
}> {
  console.log(
    `Phase 2: simulating ${params.timeline.length} hourly checks across ${params.symbols.length} symbols (concurrency=${params.concurrency})...`,
  );

  const ledger = new SimulatedLedger(params.initialCash, params.feeBps);
  const ledgerMutex = createAsyncMutex();
  const equityCurve: EquityPoint[] = [];
  const markPriceCursorBySymbol = new Map<string, number>();
  let lastProcessedOpenTime: number | null = null;

  for (const openTime of params.timeline) {
    await processInBatches({
      items: params.symbols,
      batchSize: params.concurrency,
      processItem: async (symbol) => {
        const klinesAsc = params.klinesBySymbol.get(symbol);
        if (!klinesAsc || klinesAsc.length === 0) {
          return;
        }

        const closed = getClosedWindowAt({
          klinesAsc,
          targetTime: openTime,
          count: STRATEGY_LOOKBACK_CLOSES,
        });

        if (!closed) {
          return;
        }

        const decision = evaluateDecision({
          closed,
          position: ledger.getPosition(symbol),
          cash: ledger.cash,
          lastProcessedOpenTime,
          lastSellOpenTime: ledger.lastSellOpenTime.get(symbol) ?? null,
        });

        await ledgerMutex.run(() => {
          ledger.applyDecision({
            symbol,
            decision,
            price: closed[0]!.close,
          });
        });
      },
    });

    lastProcessedOpenTime = openTime;

    const markPrices = new Map<string, number>();
    for (const [symbol, position] of ledger.positions) {
      const klinesAsc = params.klinesBySymbol.get(symbol);
      if (!klinesAsc) {
        markPrices.set(symbol, position.buyPrice);
        continue;
      }

      let cursor = markPriceCursorBySymbol.get(symbol) ?? 0;
      while (
        cursor + 1 < klinesAsc.length &&
        klinesAsc[cursor + 1]!.openTime <= openTime
      ) {
        cursor += 1;
      }
      markPriceCursorBySymbol.set(symbol, cursor);

      const candle = klinesAsc[cursor];
      if (candle && candle.openTime <= openTime) {
        markPrices.set(symbol, candle.close);
      } else {
        markPrices.set(symbol, position.buyPrice);
      }
    }

    equityCurve.push({
      openTime,
      cash: ledger.cash,
      equity: ledger.getEquity(markPrices),
    });
  }

  console.log("Phase 2 complete.");

  return { ledger, equityCurve };
}

export async function runBacktest(
  config: BacktestConfig,
): Promise<BacktestReport> {
  assertLocalhostOnly();

  const symbols = await resolveBacktestSymbols(config);

  const { startTime: fetchStartTime, endTime } = getHistoricalRange({
    days: config.days,
    now: config.now,
  });

  const evalStartTime = getEvaluationStartOpenTime({
    rangeStartTime: fetchStartTime,
    lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
  });

  const simulationStartTime = evalStartTime;
  const simulationEndTime = endTime;

  const klinesBySymbol = await preloadHistoricalKlines({
    symbols,
    interval: config.interval,
    startTime: fetchStartTime,
    endTime,
    concurrency: config.concurrency,
  });

  const timeline = buildCheckTimeline({
    startTime: simulationStartTime,
    endTime: simulationEndTime,
    checkEveryMinutes: BACKTEST_CHECK_EVERY_MINUTES,
  });

  const { ledger, equityCurve } = await runBacktestSimulation({
    symbols,
    klinesBySymbol,
    timeline,
    initialCash: config.initialCash,
    feeBps: config.feeBps,
    concurrency: config.concurrency,
  });

  const finalMarkPrices = new Map<string, number>();
  for (const [symbol, position] of ledger.positions) {
    const klinesAsc = klinesBySymbol.get(symbol);
    const lastCandle = klinesAsc?.[klinesAsc.length - 1];
    finalMarkPrices.set(symbol, lastCandle?.close ?? position.buyPrice);
  }

  return buildBacktestReport({
    startTime: simulationStartTime,
    endTime: simulationEndTime,
    initialCash: config.initialCash,
    finalEquity: ledger.getEquity(finalMarkPrices),
    trades: ledger.trades,
    equityCurve,
  });
}

export function getBacktestDurationHours(days: number): number {
  return days * 24;
}
