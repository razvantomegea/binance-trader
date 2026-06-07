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
import { liquidateAllOpenPositions } from "@/helpers/strategy/backtest/liquidate-open-positions";
import {
  buildCheckTimeline,
  getClosedWindowAt,
  getEvaluationStartOpenTime,
  getHistoricalRange,
  loadHistoricalKlinesBySymbol,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import { SimulatedLedger } from "@/helpers/strategy/backtest/simulated-ledger";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import type { StrategyParams } from "@/types/strategy-params";
import { evaluateDecision } from "@/helpers/strategy/decision-core";
import {
  isPortfolioDrawdownBreached,
  nextExposurePeakEquity,
} from "@/helpers/strategy/exposure-peak-equity";
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
export const BACKTEST_CHECK_EVERY_MINUTES = 5;

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
      if (loadedCount % PRELOAD_LOG_EVERY === 0 || loadedCount === totalCount) {
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

function buildMarkPricesForOpenPositions(params: {
  ledger: SimulatedLedger;
  klinesBySymbol: Map<string, KlineCandle[]>;
  openTime: number;
  markPriceCursorBySymbol: Map<string, number>;
}): Map<string, number> {
  const markPrices = new Map<string, number>();

  for (const [symbol, position] of params.ledger.positions) {
    const klinesAsc = params.klinesBySymbol.get(symbol);
    if (!klinesAsc) {
      markPrices.set(symbol, position.buyPrice);
      continue;
    }

    let cursor = params.markPriceCursorBySymbol.get(symbol) ?? 0;
    while (
      cursor + 1 < klinesAsc.length &&
      klinesAsc[cursor + 1]!.openTime <= params.openTime
    ) {
      cursor += 1;
    }
    params.markPriceCursorBySymbol.set(symbol, cursor);

    const candle = klinesAsc[cursor];
    if (candle && candle.openTime <= params.openTime) {
      markPrices.set(symbol, candle.close);
    } else {
      markPrices.set(symbol, position.buyPrice);
    }
  }

  return markPrices;
}

async function processSymbolAtOpenTime(params: {
  symbol: string;
  openTime: number;
  klinesBySymbol: Map<string, KlineCandle[]>;
  strategyParams: StrategyParams;
  modelMinProbability?: number;
  entryProbabilityBySymbol?: Map<string, Map<number, number>>;
  ledger: SimulatedLedger;
  ledgerMutex: ReturnType<typeof createAsyncMutex>;
  lastProcessedOpenTime: number | null;
  markPrices: Map<string, number>;
}): Promise<void> {
  const klinesAsc = params.klinesBySymbol.get(params.symbol);
  if (!klinesAsc || klinesAsc.length === 0) {
    return;
  }

  const closed = getClosedWindowAt({
    klinesAsc,
    targetTime: params.openTime,
    count: STRATEGY_LOOKBACK_CLOSES,
  });
  if (!closed) {
    return;
  }

  await params.ledgerMutex.run(() => {
    const markPrice = params.markPrices.get(params.symbol) ?? closed[0]!.close;
    const candleOpenTime = closed[0]!.openTime;
    const entryProbability = params.entryProbabilityBySymbol
      ?.get(params.symbol)
      ?.get(candleOpenTime);

    const decision = evaluateDecision({
      closed,
      position: params.ledger.getPosition(params.symbol),
      cash: params.ledger.cash,
      lastProcessedOpenTime: params.lastProcessedOpenTime,
      lastSellOpenTime: params.ledger.lastSellOpenTime.get(params.symbol) ?? null,
      markPrice,
      strategyParams: params.strategyParams,
      entryProbability,
      modelMinProbability: params.modelMinProbability,
    });

    const tradePrice =
      decision.action === "SELL" && decision.exitPrice !== undefined
        ? decision.exitPrice
        : closed[0]!.close;
    params.ledger.applyDecision({
      symbol: params.symbol,
      decision,
      price: tradePrice,
    });
  });
}

function applyDrawdownLiquidationIfNeeded(params: {
  ledger: SimulatedLedger;
  markPricesAfterTrades: Map<string, number>;
  openTime: number;
  strategyParams: StrategyParams;
  exposurePeakEquity: number | null;
}): number | null {
  const equity = params.ledger.getEquity(params.markPricesAfterTrades);
  const openPositionCount = params.ledger.positions.size;
  let nextPeak = nextExposurePeakEquity({
    currentPeak: params.exposurePeakEquity,
    equity,
    hasOpenPositions: openPositionCount > 0,
  });

  if (
    nextPeak !== null &&
    isPortfolioDrawdownBreached({
      equity,
      exposurePeakEquity: nextPeak,
      thresholdPct: params.strategyParams.maxLossPct,
    })
  ) {
    liquidateAllOpenPositions({
      ledger: params.ledger,
      markPrices: params.markPricesAfterTrades,
      candleOpenTime: params.openTime,
      trailingStopPct: params.strategyParams.trailingStopPct,
      maxLossPct: params.strategyParams.maxLossPct,
    });
    nextPeak = null;
  }
  return nextPeak;
}

async function runSimulationStep(params: {
  openTime: number;
  symbols: string[];
  concurrency: number;
  klinesBySymbol: Map<string, KlineCandle[]>;
  strategyParams: StrategyParams;
  modelMinProbability?: number;
  entryProbabilityBySymbol?: Map<string, Map<number, number>>;
  ledger: SimulatedLedger;
  ledgerMutex: ReturnType<typeof createAsyncMutex>;
  markPriceCursorBySymbol: Map<string, number>;
  exposurePeakEquity: number | null;
}): Promise<{ equityPoint: EquityPoint; nextExposurePeakEquity: number | null }> {
  const markPrices = buildMarkPricesForOpenPositions({
    ledger: params.ledger,
    klinesBySymbol: params.klinesBySymbol,
    openTime: params.openTime,
    markPriceCursorBySymbol: params.markPriceCursorBySymbol,
  });

  await processInBatches({
    items: params.symbols,
    batchSize: params.concurrency,
    processItem: (symbol) =>
      processSymbolAtOpenTime({
        symbol,
        openTime: params.openTime,
        klinesBySymbol: params.klinesBySymbol,
        strategyParams: params.strategyParams,
        modelMinProbability: params.modelMinProbability,
        entryProbabilityBySymbol: params.entryProbabilityBySymbol,
        ledger: params.ledger,
        ledgerMutex: params.ledgerMutex,
        lastProcessedOpenTime: null,
        markPrices,
      }),
  });

  const markPricesAfterTrades = buildMarkPricesForOpenPositions({
    ledger: params.ledger,
    klinesBySymbol: params.klinesBySymbol,
    openTime: params.openTime,
    markPriceCursorBySymbol: params.markPriceCursorBySymbol,
  });
  const nextExposurePeakEquity = applyDrawdownLiquidationIfNeeded({
    ledger: params.ledger,
    markPricesAfterTrades,
    openTime: params.openTime,
    strategyParams: params.strategyParams,
    exposurePeakEquity: params.exposurePeakEquity,
  });
  return {
    nextExposurePeakEquity,
    equityPoint: {
      openTime: params.openTime,
      cash: params.ledger.cash,
      equity: params.ledger.getEquity(markPricesAfterTrades),
      openPositionCount: params.ledger.positions.size,
    },
  };
}

async function runBacktestSimulation(params: {
  symbols: string[];
  klinesBySymbol: Map<string, KlineCandle[]>;
  timeline: number[];
  initialCash: number;
  feeBps: number;
  concurrency: number;
  strategyParams: StrategyParams;
  modelMinProbability?: number;
  entryProbabilityBySymbol?: Map<string, Map<number, number>>;
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
  let exposurePeakEquity: number | null = null;

  for (const openTime of params.timeline) {
    const step = await runSimulationStep({
      openTime,
      symbols: params.symbols,
      concurrency: params.concurrency,
      klinesBySymbol: params.klinesBySymbol,
      strategyParams: params.strategyParams,
      modelMinProbability: params.modelMinProbability,
      entryProbabilityBySymbol: params.entryProbabilityBySymbol,
      ledger,
      ledgerMutex,
      markPriceCursorBySymbol,
      exposurePeakEquity,
    });
    exposurePeakEquity = step.nextExposurePeakEquity;
    equityCurve.push(step.equityPoint);
  }

  console.log("Phase 2 complete.");

  return { ledger, equityCurve };
}

export async function runBacktestWithPreloadedKlines(params: {
  config: BacktestConfig;
  symbols: string[];
  klinesBySymbol: Map<string, KlineCandle[]>;
  simulationStartTime: number;
  simulationEndTime: number;
}): Promise<BacktestReport> {
  const strategyParams =
    params.config.strategyParams ?? DEFAULT_STRATEGY_PARAMS;

  const timeline = buildCheckTimeline({
    startTime: params.simulationStartTime,
    endTime: params.simulationEndTime,
    checkEveryMinutes: BACKTEST_CHECK_EVERY_MINUTES,
  });

  const { ledger, equityCurve } = await runBacktestSimulation({
    symbols: params.symbols,
    klinesBySymbol: params.klinesBySymbol,
    timeline,
    initialCash: params.config.initialCash,
    feeBps: params.config.feeBps,
    concurrency: params.config.concurrency,
    strategyParams,
    modelMinProbability: params.config.modelMinProbability,
    entryProbabilityBySymbol: params.config.entryProbabilityBySymbol,
  });

  const finalMarkPrices = new Map<string, number>();
  for (const [symbol, position] of ledger.positions) {
    const klinesAsc = params.klinesBySymbol.get(symbol);
    const lastCandle = klinesAsc?.[klinesAsc.length - 1];
    finalMarkPrices.set(symbol, lastCandle?.close ?? position.buyPrice);
  }

  return buildBacktestReport({
    startTime: params.simulationStartTime,
    endTime: params.simulationEndTime,
    initialCash: params.config.initialCash,
    finalEquity: ledger.getEquity(finalMarkPrices),
    trades: ledger.trades,
    equityCurve,
  });
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

  const klinesBySymbol = await preloadHistoricalKlines({
    symbols,
    interval: config.interval,
    startTime: fetchStartTime,
    endTime,
    concurrency: config.concurrency,
  });

  return runBacktestWithPreloadedKlines({
    config,
    symbols,
    klinesBySymbol,
    simulationStartTime: evalStartTime,
    simulationEndTime: endTime,
  });
}

