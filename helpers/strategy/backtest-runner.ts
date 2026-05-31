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
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";

const DEFAULT_FEE_BPS = 0;

function normalizeAndValidateUsdtSymbols(symbols: string[]): string[] {
  const normalized = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  const invalid = normalized.filter((symbol) => !symbol.endsWith("USDT"));
  if (invalid.length > 0) {
    throw new Error(
      `Only USDT symbols are allowed. Invalid: ${invalid.join(", ")}`,
    );
  }

  return [...new Set(normalized)].sort();
}

export function createDefaultBacktestConfig(
  overrides: Partial<BacktestConfig> = {},
): BacktestConfig {
  return {
    days: 365,
    initialCash: INITIAL_PAPER_CASH,
    concurrency: BINANCE_FETCH_CONCURRENCY,
    feeBps: DEFAULT_FEE_BPS,
    checkEveryMinutes: 15,
    interval: STRATEGY_INTERVAL,
    ...overrides,
  };
}

export async function runBacktest(
  config: BacktestConfig,
): Promise<BacktestReport> {
  assertLocalhostOnly();

  const symbols =
    config.symbols && config.symbols.length > 0
      ? normalizeAndValidateUsdtSymbols(config.symbols)
      : [...(await getTradingSymbols())].sort();

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

  const klinesBySymbol = await loadHistoricalKlinesBySymbol({
    symbols,
    interval: config.interval,
    startTime: fetchStartTime,
    endTime,
    concurrency: config.concurrency,
  });

  const timeline = buildCheckTimeline({
    startTime: simulationStartTime,
    endTime: simulationEndTime,
    checkEveryMinutes: config.checkEveryMinutes,
  });

  const ledger = new SimulatedLedger(config.initialCash, config.feeBps);
  const equityCurve: EquityPoint[] = [];
  const markPriceCursorBySymbol = new Map<string, number>();
  let lastProcessedOpenTime: number | null = null;

  for (const openTime of timeline) {
    for (const symbol of symbols) {
      const klinesAsc = klinesBySymbol.get(symbol);
      if (!klinesAsc || klinesAsc.length === 0) {
        continue;
      }

      const closed = getClosedWindowAt({
        klinesAsc,
        targetTime: openTime,
        count: STRATEGY_LOOKBACK_CLOSES,
      });

      if (!closed) {
        continue;
      }

      const decision = evaluateDecision({
        closed,
        position: ledger.getPosition(symbol),
        cash: ledger.cash,
        lastProcessedOpenTime,
        lastSellOpenTime: ledger.lastSellOpenTime.get(symbol) ?? null,
      });

      ledger.applyDecision({
        symbol,
        decision,
        price: closed[0]!.close,
      });
    }

    lastProcessedOpenTime = openTime;

    const markPrices = new Map<string, number>();
    for (const [symbol, position] of ledger.positions) {
      const klinesAsc = klinesBySymbol.get(symbol);
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
