import {
  BUY_NOTIONAL_PCT,
  ENTRY_PUMP_PCT,
  STOP_LOSS_PCT,
  TAKE_PROFIT_PCT,
} from "@/constants/binance";
import { getDb } from "@/db";
import { positions } from "@/db/schema";
import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
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
  const priorCloses = closed.slice(1).map((candle) => candle.close);

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
    const currentMax = position.maxPriceAfterBuy ?? position.buyPrice;
    if (close > currentMax) {
      await getDb()
        .update(positions)
        .set({ maxPriceAfterBuy: String(close) })
        .where(eq(positions.symbol, symbol));
    }

    const exitRefs = [position.buyPrice];

    const shouldStop = hasLossVsAnyRef({
      reference: close,
      refs: exitRefs,
      thresholdPct: STOP_LOSS_PCT,
    });

    if (shouldStop) {
      await placeTrade({
        symbol,
        side: "SELL",
        qty: position.qty,
        price: close,
        interval,
        candleOpenTime: latest.openTime,
        reason: "stop_loss_15pct_vs_buy",
      });
      return { candleOpenTime: latest.openTime, traded: true };
    }

    const shouldTakeProfit = hasGainVsAnyRef({
      reference: close,
      refs: exitRefs,
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

  if (
    !hasGainVsAnyRef({
      reference: close,
      refs: priorCloses,
      thresholdPct: ENTRY_PUMP_PCT,
    })
  ) {
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
    reason: "entry_pump_50pct_vs_prior_23h",
  });

  return { candleOpenTime: latest.openTime, traded: true };
}
