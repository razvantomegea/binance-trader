import type { KlineCandle } from "@/types/binance";
import {
  NULL_TRADE_POST_CLOSE_24H,
  POST_CLOSE_WINDOW_CANDLES,
  type TradePostClose24hMetrics,
} from "@/types/trade-metrics";
import { pnlPercentFromPrices } from "@/utils/pnl-percent";

interface ComputePostClose24hExtremaParams {
  klinesAsc: KlineCandle[];
  sellCandleOpenTime: number;
  sellClosePrice: number;
  /** When set, slice future candles by index instead of scanning for openTime. */
  sellCandleIndex?: number;
}

export function computePostClose24hExtrema({
  klinesAsc,
  sellCandleOpenTime,
  sellClosePrice,
  sellCandleIndex,
}: ComputePostClose24hExtremaParams): TradePostClose24hMetrics {
  if (!Number.isFinite(sellClosePrice) || sellClosePrice <= 0) {
    return { ...NULL_TRADE_POST_CLOSE_24H };
  }

  const idx =
    sellCandleIndex ??
    klinesAsc.findIndex((candle) => candle.openTime === sellCandleOpenTime);

  if (idx < 0) {
    return { ...NULL_TRADE_POST_CLOSE_24H };
  }

  const future = klinesAsc.slice(idx + 1, idx + 1 + POST_CLOSE_WINDOW_CANDLES);

  if (future.length === 0) {
    return { ...NULL_TRADE_POST_CLOSE_24H };
  }

  let postMax = -Infinity;
  let postMin = Infinity;

  for (const candle of future) {
    if (candle.high > postMax) {
      postMax = candle.high;
    }
    if (candle.low < postMin) {
      postMin = candle.low;
    }
  }

  if (!Number.isFinite(postMax) || !Number.isFinite(postMin)) {
    return { ...NULL_TRADE_POST_CLOSE_24H };
  }

  const maxPriceAfterClose24hPct = pnlPercentFromPrices(
    sellClosePrice,
    postMax,
  );
  const minPriceAfterClose24hPct = pnlPercentFromPrices(
    sellClosePrice,
    postMin,
  );

  return {
    maxPriceAfterClose24h: postMax,
    minPriceAfterClose24h: postMin,
    maxPriceAfterClose24hPct,
    minPriceAfterClose24hPct,
  };
}

export function buildKlineOpenTimeIndex(
  klinesAsc: KlineCandle[],
): Map<number, number> {
  const index = new Map<number, number>();
  for (let i = 0; i < klinesAsc.length; i += 1) {
    index.set(klinesAsc[i]!.openTime, i);
  }
  return index;
}
