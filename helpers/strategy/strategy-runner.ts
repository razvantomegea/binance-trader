import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import {
  evaluateSymbol,
  type EvaluateSymbolResult,
} from "@/helpers/strategy/evaluate-symbol";
import { getCash } from "@/helpers/strategy/get-cash";
import {
  getLastCandleTime,
  setLastCandleTime,
} from "@/helpers/strategy/get-last-candle-time";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import type { OpenPosition } from "@/helpers/strategy/get-positions";
import { enforcePortfolioDrawdownCap } from "@/helpers/strategy/enforce-portfolio-drawdown-cap";
import { snapshotEquity } from "@/helpers/strategy/snapshot-equity";
import { backfillMaxPriceAfterBuy } from "@/helpers/trades/backfill-max-price-after-buy";
import { backfillPostClose24hMetrics } from "@/helpers/trades/backfill-post-close-24h";
import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";
import { processInBatches } from "@/utils/process-in-batches";

export interface RunStrategyResult {
  interval: typeof STRATEGY_INTERVAL;
  symbolsEvaluated: number;
  tradesExecuted: number;
  cash: number;
  equity: number;
  postClose24hBackfill: {
    scanned: number;
    updated: number;
    skipped: number;
  };
  maxPriceAfterBuyBackfill: {
    scanned: number;
    updated: number;
    skipped: number;
  };
}

function updateLatestCandleTime(
  current: number | null,
  next: number | null,
): number | null {
  if (next === null) {
    return current;
  }
  if (current === null || next > current) {
    return next;
  }
  return current;
}

async function refreshPortfolioState(params: {
  positions: Map<string, OpenPosition>;
}) {
  const refreshed = await getOpenPositions();
  params.positions.clear();
  for (const [key, value] of refreshed) {
    params.positions.set(key, value);
  }
}

async function backfillWithFallback<T>(
  run: () => Promise<T>,
  fallback: T,
  errorPrefix: string,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(errorPrefix, error);
    return fallback;
  }
}

const EMPTY_BACKFILL = { scanned: 0, updated: 0, skipped: 0 };

async function runStrategyBackfills(): Promise<
  Pick<
    RunStrategyResult,
    "postClose24hBackfill" | "maxPriceAfterBuyBackfill"
  >
> {
  const postClose24hBackfill = await backfillWithFallback(
    () => backfillPostClose24hMetrics(),
    EMPTY_BACKFILL,
    "Post-close 24h backfill failed:",
  );
  const maxPriceAfterBuyBackfill = await backfillWithFallback(
    () => backfillMaxPriceAfterBuy(),
    EMPTY_BACKFILL,
    "Max-price-after-buy backfill failed:",
  );
  return { postClose24hBackfill, maxPriceAfterBuyBackfill };
}

async function evaluateSymbolBatch(params: {
  batch: string[];
  interval: typeof STRATEGY_INTERVAL;
  positions: Map<string, OpenPosition>;
  cash: number;
  lastProcessed: number | null;
}): Promise<(EvaluateSymbolResult | null)[]> {
  return processInBatches({
    items: params.batch,
    batchSize: BINANCE_FETCH_CONCURRENCY,
    processItem: async (symbol): Promise<EvaluateSymbolResult | null> => {
      try {
        return await evaluateSymbol({
          symbol,
          interval: params.interval,
          position: params.positions.get(symbol),
          cash: params.cash,
          lastProcessedOpenTime: params.lastProcessed,
        });
      } catch (error) {
        console.error(`[runStrategy] ${symbol} failed:`, error);
        return null;
      }
    },
  });
}

async function runSymbolEvaluationLoop(params: {
  symbols: string[];
  interval: typeof STRATEGY_INTERVAL;
  lastProcessed: number | null;
  positions: Map<string, OpenPosition>;
  initialCash: number;
}): Promise<{
  tradesExecuted: number;
  latestCandleOpenTime: number | null;
}> {
  let cash = params.initialCash;
  let tradesExecuted = 0;
  let latestCandleOpenTime = params.lastProcessed;

  for (
    let index = 0;
    index < params.symbols.length;
    index += BINANCE_FETCH_CONCURRENCY
  ) {
    const batch = params.symbols.slice(
      index,
      index + BINANCE_FETCH_CONCURRENCY,
    );
    const batchResults = await evaluateSymbolBatch({
      batch,
      interval: params.interval,
      positions: params.positions,
      cash,
      lastProcessed: params.lastProcessed,
    });

    let batchHadTrade = false;
    for (const result of batchResults) {
      if (result === null) {
        continue;
      }
      latestCandleOpenTime = updateLatestCandleTime(
        latestCandleOpenTime,
        result.candleOpenTime,
      );
      if (result.traded) {
        tradesExecuted += 1;
        batchHadTrade = true;
      }
    }

    if (batchHadTrade) {
      cash = await getCash();
      await refreshPortfolioState({ positions: params.positions });
    }
  }

  return { tradesExecuted, latestCandleOpenTime };
}

export async function runStrategy(): Promise<RunStrategyResult> {
  const interval = STRATEGY_INTERVAL;
  const symbols = (await getUsdtSymbols()).filter(isUsdtSymbol);
  if (symbols.length === 0) {
    throw new Error("No valid USDT symbols available for strategy run.");
  }
  const lastProcessed = await getLastCandleTime(interval);
  const positions = await getOpenPositions();
  const initialCash = await getCash();

  const { tradesExecuted, latestCandleOpenTime } =
    await runSymbolEvaluationLoop({
      symbols,
      interval,
      lastProcessed,
      positions,
      initialCash,
    });

  if (latestCandleOpenTime !== null) {
    await setLastCandleTime({ interval, openTime: latestCandleOpenTime });
  }

  await enforcePortfolioDrawdownCap({ interval });

  const { cash: finalCash, equity } = await snapshotEquity({ interval });
  const { postClose24hBackfill, maxPriceAfterBuyBackfill } =
    await runStrategyBackfills();

  return {
    interval,
    symbolsEvaluated: symbols.length,
    tradesExecuted,
    cash: finalCash,
    equity,
    postClose24hBackfill,
    maxPriceAfterBuyBackfill,
  };
}
