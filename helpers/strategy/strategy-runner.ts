import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { evaluateSymbol } from "@/helpers/strategy/evaluate-symbol";
import { getCash } from "@/helpers/strategy/get-cash";
import {
  getLastCandleTime,
  setLastCandleTime,
} from "@/helpers/strategy/get-last-candle-time";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import { snapshotEquity } from "@/helpers/strategy/snapshot-equity";
import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";
import { processInBatches } from "@/utils/process-in-batches";

export interface RunStrategyResult {
  interval: typeof STRATEGY_INTERVAL;
  symbolsEvaluated: number;
  tradesExecuted: number;
  cash: number;
  equity: number;
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
      const result = await evaluateSymbol({
        symbol,
        interval,
        position: positions.get(symbol),
        cash,
        lastProcessedOpenTime: lastProcessed,
      });

      if (result.candleOpenTime !== null) {
        if (
          latestCandleOpenTime === null ||
          result.candleOpenTime > latestCandleOpenTime
        ) {
          latestCandleOpenTime = result.candleOpenTime;
        }
      }

      if (result.traded) {
        tradesExecuted += 1;
        cash = await getCash();
        const refreshed = await getOpenPositions();
        positions.clear();
        for (const [key, value] of refreshed) {
          positions.set(key, value);
        }
      }
    },
  });

  if (latestCandleOpenTime !== null) {
    await setLastCandleTime({ interval, openTime: latestCandleOpenTime });
  }

  const { cash: finalCash, equity } = await snapshotEquity({ interval });

  return {
    interval,
    symbolsEvaluated: symbols.length,
    tradesExecuted,
    cash: finalCash,
    equity,
  };
}
