import {
  BUY_NOTIONAL_PCT,
  ENTRY_MAX_RANGE_PCT,
  ENTRY_PULLBACK_PCT,
  ENTRY_RANGE_PCT,
  EXIT_DRAWDOWN_PCT,
  TAKE_PROFIT_PCT,
} from "@/constants/binance";
import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import {
  hasGainVsAnyRef,
  hasLossVsAnyRef,
} from "@/utils/strategy/price-change-conditions";

export interface CandleSlice {
  openTime: number;
  high: number;
  low: number;
  close: number;
}

export interface DecisionPositionState {
  qty: number;
  buyPrice: number;
  maxPriceAfterBuy: number | null;
  buyOpenTime: number;
}

export interface EvaluateDecisionParams {
  closed: CandleSlice[];
  position: DecisionPositionState | undefined;
  cash: number;
  lastProcessedOpenTime: number | null;
  lastSellOpenTime: number | null;
}

export type DecisionAction = "BUY" | "SELL" | "HOLD" | "SKIP";

export interface EvaluateDecisionResult {
  action: DecisionAction;
  candleOpenTime: number | null;
  reason?: string;
  qty?: number;
  updatedMaxPrice?: number;
}

export function get24hHighLow(closed: Pick<CandleSlice, "high" | "low">[]): {
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

export function evaluateDecision({
  closed,
  position,
  cash,
  lastProcessedOpenTime,
  lastSellOpenTime,
}: EvaluateDecisionParams): EvaluateDecisionResult {
  if (closed.length < STRATEGY_LOOKBACK_CLOSES) {
    return { action: "SKIP", candleOpenTime: null };
  }

  const latest = closed[0]!;

  if (
    lastProcessedOpenTime !== null &&
    latest.openTime <= lastProcessedOpenTime
  ) {
    return { action: "SKIP", candleOpenTime: latest.openTime };
  }

  const { close } = latest;

  if (position) {
    if (latest.openTime < position.buyOpenTime) {
      return { action: "SKIP", candleOpenTime: latest.openTime };
    }

    const currentMax =
      position.maxPriceAfterBuy !== null
        ? position.maxPriceAfterBuy
        : position.buyPrice;
    const updatedMax = close > currentMax ? close : currentMax;

    const trailingRef = Math.max(position.buyPrice, updatedMax);

    const shouldStop = hasLossVsAnyRef({
      reference: close,
      refs: [trailingRef],
      thresholdPct: EXIT_DRAWDOWN_PCT,
    });

    if (shouldStop) {
      return {
        action: "SELL",
        candleOpenTime: latest.openTime,
        reason: "exit_drawdown_15pct_vs_peak",
        qty: position.qty,
      };
    }

    const shouldTakeProfit = hasGainVsAnyRef({
      reference: close,
      refs: [position.buyPrice],
      thresholdPct: TAKE_PROFIT_PCT,
    });

    if (shouldTakeProfit) {
      return {
        action: "SELL",
        candleOpenTime: latest.openTime,
        reason: "take_profit_50pct_vs_buy",
        qty: position.qty,
      };
    }

    return {
      action: "HOLD",
      candleOpenTime: latest.openTime,
      updatedMaxPrice: updatedMax,
    };
  }

  if (
    lastSellOpenTime !== null &&
    latest.openTime - lastSellOpenTime < SYMBOL_REENTRY_COOLDOWN_MS
  ) {
    return { action: "HOLD", candleOpenTime: latest.openTime };
  }

  const { high24h, low24h } = get24hHighLow(closed);

  const rangePct =
    low24h > 0 ? (high24h - low24h) / low24h : Number.POSITIVE_INFINITY;
  const hasEntryRange = hasGainVsAnyRef({
    reference: high24h,
    refs: [low24h],
    thresholdPct: ENTRY_RANGE_PCT,
  });
  const isWithinEntryMaxRange = rangePct <= ENTRY_MAX_RANGE_PCT;

  const isNear24hHigh =
    high24h > 0 && close > high24h * (1 - ENTRY_PULLBACK_PCT);

  if (!hasEntryRange || !isWithinEntryMaxRange || !isNear24hHigh) {
    return { action: "HOLD", candleOpenTime: latest.openTime };
  }

  const notional = cash * BUY_NOTIONAL_PCT;

  if (notional <= 0 || close <= 0) {
    return { action: "HOLD", candleOpenTime: latest.openTime };
  }

  const qty = notional / close;
  if (!Number.isFinite(qty) || qty <= 0) {
    return { action: "HOLD", candleOpenTime: latest.openTime };
  }

  return {
    action: "BUY",
    candleOpenTime: latest.openTime,
    reason: "entry_24h_range_50pct_near_high",
    qty,
  };
}
