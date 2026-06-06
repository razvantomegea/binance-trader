import { getDb } from "@/db";
import { positions } from "@/db/schema";
import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import {
  evaluateDecision,
  type DecisionPositionState,
} from "@/helpers/strategy/decision-core";
import { getLastSymbolCloseTime } from "@/helpers/strategy/get-last-symbol-close-time";
import { placeTrade } from "@/helpers/strategy/place-trade";
import type { OpenPosition } from "@/helpers/strategy/get-positions";
import type { CandleInterval } from "@/types/binance";
import { getRecentClosedKlines } from "@/utils/binance/get-klines";
import { getUpdatedPeakPrice } from "@/utils/strategy/trailing-stop";
import { eq } from "drizzle-orm";

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

function toDecisionPosition(position: OpenPosition): DecisionPositionState {
  return {
    qty: position.qty,
    buyPrice: position.buyPrice,
    maxPriceAfterBuy: position.maxPriceAfterBuy,
    buyOpenTime: position.buyTime.getTime(),
  };
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

  const lastSellOpenTime = position
    ? null
    : await getLastSymbolCloseTime(symbol);

  const latestClose = closed[0]!.close;

  const decision = evaluateDecision({
    closed,
    position: position ? toDecisionPosition(position) : undefined,
    cash,
    lastProcessedOpenTime,
    lastSellOpenTime,
    markPrice: latestClose,
  });

  if (decision.action === "SKIP" || decision.candleOpenTime === null) {
    return { candleOpenTime: decision.candleOpenTime, traded: false };
  }

  if (
    decision.action === "HOLD" &&
    position &&
    decision.updatedMaxPrice !== undefined &&
    decision.updatedMaxPrice > (position.maxPriceAfterBuy ?? position.buyPrice)
  ) {
    await getDb()
      .update(positions)
      .set({ maxPriceAfterBuy: String(decision.updatedMaxPrice) })
      .where(eq(positions.symbol, symbol));
  }

  if (decision.action === "BUY" || decision.action === "SELL") {
    const side = decision.action;
    const latestCandle = closed[0]!;
    const tradePrice =
      side === "SELL" && decision.exitPrice !== undefined
        ? decision.exitPrice
        : latestClose;
    const maxPriceAfterBuy =
      side === "SELL" && decision.updatedMaxPrice !== undefined
        ? decision.updatedMaxPrice
        : side === "BUY"
          ? getUpdatedPeakPrice({
              currentMax: latestClose,
              high: latestCandle.high,
              close: latestClose,
              markPrice: latestClose,
            })
          : undefined;

    await placeTrade({
      symbol,
      side,
      qty: decision.qty!,
      price: tradePrice,
      interval,
      candleOpenTime: decision.candleOpenTime,
      reason: decision.reason!,
      maxPriceAfterBuy,
    });
    return { candleOpenTime: decision.candleOpenTime, traded: true };
  }

  return { candleOpenTime: decision.candleOpenTime, traded: false };
}
