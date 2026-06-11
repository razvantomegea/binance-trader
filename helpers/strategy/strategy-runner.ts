import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { evaluateSymbol } from "@/helpers/strategy/evaluate-symbol";
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

export async function runStrategy(): Promise<RunStrategyResult> {
  const interval = STRATEGY_INTERVAL;
  const symbols = (await getUsdtSymbols()).filter(isUsdtSymbol);
  if (symbols.length === 0) {
    throw new Error("No valid USDT symbols available for strategy run.");
  }
  const lastProcessed = await getLastCandleTime(interval);
  const positions = await getOpenPositions();
  let cash = await getCash();

  let tradesExecuted = 0;
  let latestCandleOpenTime = lastProcessed;

  await processInBatches({
    items: symbols,
    batchSize: BINANCE_FETCH_CONCURRENCY,
    processItem: async (symbol) => {
      try {
        const result = await evaluateSymbol({
          symbol,
          interval,
          position: positions.get(symbol),
          cash,
          lastProcessedOpenTime: lastProcessed,
        });

        latestCandleOpenTime = updateLatestCandleTime(
          latestCandleOpenTime,
          result.candleOpenTime,
        );

        if (result.traded) {
          tradesExecuted += 1;
          cash = await getCash();
          await refreshPortfolioState({ positions });
        }
      } catch (error) {
        console.error(`[runStrategy] ${symbol} failed:`, error);
      }
    },
  });

  if (latestCandleOpenTime !== null) {
    await setLastCandleTime({ interval, openTime: latestCandleOpenTime });
  }

  await enforcePortfolioDrawdownCap({ interval });

  const { cash: finalCash, equity } = await snapshotEquity({ interval });
  const postClose24hBackfill = await backfillWithFallback(
    () => backfillPostClose24hMetrics(),
    { scanned: 0, updated: 0, skipped: 0 },
    "Post-close 24h backfill failed:",
  );
  const maxPriceAfterBuyBackfill = await backfillWithFallback(
    () => backfillMaxPriceAfterBuy(),
    { scanned: 0, updated: 0, skipped: 0 },
    "Max-price-after-buy backfill failed:",
  );

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
