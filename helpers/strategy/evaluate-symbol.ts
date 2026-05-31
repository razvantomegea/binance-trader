import {
  BUY_NOTIONAL_PCT,
  ENTRY_PULLBACK_PCT,
  ENTRY_RANGE_PCT,
  EXIT_DRAWDOWN_PCT,
  TAKE_PROFIT_PCT,
} from "@/constants/binance";
import { getDb } from "@/db";
import { positions } from "@/db/schema";
import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import { getLastSymbolCloseTime } from "@/helpers/strategy/get-last-symbol-close-time";
import { placeTrade } from "@/helpers/strategy/place-trade";
import type { OpenPosition } from "@/helpers/strategy/get-positions";
import type { CandleInterval } from "@/types/binance";
import { getRecentClosedKlines } from "@/utils/binance/get-klines";
import { eq } from "drizzle-orm";
import {
  hasGainVsAnyRef,
  hasLossVsAnyRef,
} from "@/utils/strategy/price-change-conditions";

interface EvaluateSymbolParams {
  symbol: string;
  interval: CandleInterval;
  position: OpenPosition | undefined;
  cash: number;
  lastProcessedOpenTime: number | null;
}

export interface EvaluateSymbolResult {
  candleOpenTime: number | null;
  traded: boolean;
}

function get24hHighLow(closed: { high: number; low: number }[]): {
  high24h: number;
  low24h: number;
} {
  let high24h = closed[0]!.high;
  let low24h = closed[0]!.low;

  for (const candle of closed) {
    if (candle.high > high24h) {
      high24h = candle.high;
    }
    if (candle.low < low24h) {
      low24h = candle.low;
    }
  }

  return { high24h, low24h };
}

export async function evaluateSymbol({
  symbol,
  interval,
  position,
  cash,
  lastProcessedOpenTime,
}: EvaluateSymbolParams): Promise<EvaluateSymbolResult> {
  const closed = await getRecentClosedKlines({
    symbol,
    interval,
    count: STRATEGY_LOOKBACK_CLOSES,
  });

  if (closed.length < STRATEGY_LOOKBACK_CLOSES) {
    return { candleOpenTime: null, traded: false };
  }

  const latest = closed[0]!;

  if (
    lastProcessedOpenTime !== null &&
    latest.openTime <= lastProcessedOpenTime
  ) {
    return { candleOpenTime: latest.openTime, traded: false };
  }

  const { close } = latest;

  if (position) {
    const buyOpenTime = position.buyTime.getTime();
    if (latest.openTime < buyOpenTime) {
      return { candleOpenTime: latest.openTime, traded: false };
    }

    const currentMax =
      position.maxPriceAfterBuy !== null
        ? position.maxPriceAfterBuy
        : position.buyPrice;
    const updatedMax = close > currentMax ? close : currentMax;

    if (close > currentMax) {
      await getDb()
        .update(positions)
        .set({ maxPriceAfterBuy: String(close) })
        .where(eq(positions.symbol, symbol));
    }

    const trailingRef = Math.max(position.buyPrice, updatedMax);

    const shouldStop = hasLossVsAnyRef({
      reference: close,
      refs: [trailingRef],
      thresholdPct: EXIT_DRAWDOWN_PCT,
    });

    if (shouldStop) {
      await placeTrade({
        symbol,
        side: "SELL",
        qty: position.qty,
        price: close,
        interval,
        candleOpenTime: latest.openTime,
        reason: "exit_drawdown_15pct_vs_peak",
      });
      return { candleOpenTime: latest.openTime, traded: true };
    }

    const shouldTakeProfit = hasGainVsAnyRef({
      reference: close,
      refs: [position.buyPrice],
      thresholdPct: TAKE_PROFIT_PCT,
    });

    if (shouldTakeProfit) {
      await placeTrade({
        symbol,
        side: "SELL",
        qty: position.qty,
        price: close,
        interval,
        candleOpenTime: latest.openTime,
        reason: "take_profit_50pct_vs_buy",
      });
      return { candleOpenTime: latest.openTime, traded: true };
    }

    return { candleOpenTime: latest.openTime, traded: false };
  }

  const lastCloseTime = await getLastSymbolCloseTime(symbol);
  if (
    lastCloseTime !== null &&
    latest.openTime - lastCloseTime < SYMBOL_REENTRY_COOLDOWN_MS
  ) {
    return { candleOpenTime: latest.openTime, traded: false };
  }

  const { high24h, low24h } = get24hHighLow(closed);

  const hasEntryRange = hasGainVsAnyRef({
    reference: high24h,
    refs: [low24h],
    thresholdPct: ENTRY_RANGE_PCT,
  });

  const isNear24hHigh =
    high24h > 0 && close > high24h * (1 - ENTRY_PULLBACK_PCT);

  if (!hasEntryRange || !isNear24hHigh) {
    return { candleOpenTime: latest.openTime, traded: false };
  }

  const notional = cash * BUY_NOTIONAL_PCT;

  if (notional <= 0 || close <= 0) {
    return { candleOpenTime: latest.openTime, traded: false };
  }

  const qty = notional / close;
  if (!Number.isFinite(qty) || qty <= 0) {
    return { candleOpenTime: latest.openTime, traded: false };
  }

  await placeTrade({
    symbol,
    side: "BUY",
    qty,
    price: close,
    interval,
    candleOpenTime: latest.openTime,
    reason: "entry_24h_range_50pct_near_high",
  });

  return { candleOpenTime: latest.openTime, traded: true };
}
