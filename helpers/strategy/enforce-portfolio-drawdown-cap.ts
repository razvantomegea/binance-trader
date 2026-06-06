import {
  BINANCE_FETCH_CONCURRENCY,
  TRAILING_STOP_PCT,
} from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import {
  getExposurePeakEquity,
  isPortfolioDrawdownBreached,
  nextExposurePeakEquity,
  setExposurePeakEquity,
} from "@/helpers/strategy/exposure-peak-equity";
import { EXIT_PORTFOLIO_DRAWDOWN_REASON } from "@/helpers/strategy/backtest/liquidate-open-positions";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import { placeTrade } from "@/helpers/strategy/place-trade";
import { snapshotEquity } from "@/helpers/strategy/snapshot-equity";
import type { CandleInterval } from "@/types/binance";
import { getLatestClosedKline } from "@/utils/binance/get-klines";
import { resolveTrailingSellPrice } from "@/utils/strategy/trailing-stop";
import { processInBatches } from "@/utils/process-in-batches";

export async function enforcePortfolioDrawdownCap(params: {
  interval?: CandleInterval;
}): Promise<{ liquidated: number }> {
  const interval = params.interval ?? STRATEGY_INTERVAL;
  const positions = await getOpenPositions();
  const { equity } = await snapshotEquity({ interval });

  if (positions.size === 0) {
    await setExposurePeakEquity({ interval, peakEquity: null });
    return { liquidated: 0 };
  }

  const storedPeak = await getExposurePeakEquity(interval);
  const exposurePeak = nextExposurePeakEquity({
    currentPeak: storedPeak,
    equity,
    hasOpenPositions: true,
  });

  if (exposurePeak === null) {
    return { liquidated: 0 };
  }

  await setExposurePeakEquity({ interval, peakEquity: exposurePeak });

  if (
    !isPortfolioDrawdownBreached({ equity, exposurePeakEquity: exposurePeak })
  ) {
    return { liquidated: 0 };
  }

  const symbols = [...positions.keys()];
  let liquidated = 0;

  await processInBatches({
    items: symbols,
    batchSize: BINANCE_FETCH_CONCURRENCY,
    processItem: async (symbol) => {
      const position = positions.get(symbol);
      if (!position) {
        return;
      }

      const candle = await getLatestClosedKline({ symbol, interval });
      const mark = candle?.close ?? position.buyPrice;
      const sellPrice = resolveTrailingSellPrice({
        position: {
          buyPrice: position.buyPrice,
          maxPriceAfterBuy: position.maxPriceAfterBuy,
        },
        marketPrice: mark,
        thresholdPct: TRAILING_STOP_PCT,
      });

      try {
        await placeTrade({
          symbol,
          side: "SELL",
          qty: position.qty,
          price: sellPrice,
          interval,
          candleOpenTime: candle?.openTime ?? Date.now(),
          reason: EXIT_PORTFOLIO_DRAWDOWN_REASON,
        });
        liquidated += 1;
      } catch (error) {
        console.error(
          `Portfolio drawdown liquidation failed for ${symbol}:`,
          error,
        );
      }
    },
  });

  await setExposurePeakEquity({ interval, peakEquity: null });
  return { liquidated };
}
