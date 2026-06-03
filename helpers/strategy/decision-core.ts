import {
  BUY_NOTIONAL_PCT,
  ENTRY_MAX_RANGE_PCT,
  ENTRY_PULLBACK_PCT,
  ENTRY_RANGE_PCT,
  EXIT_DRAWDOWN_PCT,
} from "@/constants/binance";
import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import { hasGainVsAnyRef } from "@/utils/strategy/price-change-conditions";
import {
  getTrailingExitPrice,
  getUpdatedPeakPrice,
  getWorstObservedPrice,
  shouldTriggerTrailingStop,
} from "@/utils/strategy/trailing-stop";

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
  /** Live/backtest mark price for intrabar stop checks (defaults to latest close). */
  markPrice?: number;
}

export type DecisionAction = "BUY" | "SELL" | "HOLD" | "SKIP";

export interface EvaluateDecisionResult {
  action: DecisionAction;
  candleOpenTime: number | null;
  reason?: string;
  qty?: number;
  updatedMaxPrice?: number;
  /** Fill price for SELL; capped to trailing stop (max 15% loss vs entry/peak). */
  exitPrice?: number;
}

export function get24hHighLow(
  closed: Pick<CandleSlice, "openTime" | "high" | "low">[],
): {
  high24h: number;
  low24h: number;
  highOpenTime: number;
  lowOpenTime: number;
} {
  let high24h = closed[0]!.high;
  let highOpenTime = closed[0]!.openTime;
  let low24h = closed[0]!.low;
  let lowOpenTime = closed[0]!.openTime;

  for (const candle of closed) {
    if (candle.high > high24h) {
      high24h = candle.high;
      highOpenTime = candle.openTime;
    }
    if (candle.low < low24h) {
      low24h = candle.low;
      lowOpenTime = candle.openTime;
    }
  }

  return { high24h, low24h, highOpenTime, lowOpenTime };
}

export function evaluateDecision({
  closed,
  position,
  cash,
  lastProcessedOpenTime,
  lastSellOpenTime,
  markPrice,
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
    const updatedMax = getUpdatedPeakPrice({
      currentMax,
      high: latest.high,
      close,
      markPrice,
    });

    const stopPosition = {
      buyPrice: position.buyPrice,
      maxPriceAfterBuy: updatedMax,
    };
    const worstPrice = getWorstObservedPrice({
      low: latest.low,
      markPrice: markPrice ?? close,
    });

    if (
      shouldTriggerTrailingStop({
        position: stopPosition,
        worstPrice,
        thresholdPct: EXIT_DRAWDOWN_PCT,
      })
    ) {
      const exitPrice = getTrailingExitPrice({
        position: stopPosition,
        thresholdPct: EXIT_DRAWDOWN_PCT,
      });

      return {
        action: "SELL",
        candleOpenTime: latest.openTime,
        reason: "exit_drawdown_15pct_vs_peak",
        qty: position.qty,
        exitPrice,
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

  const { high24h, low24h, highOpenTime, lowOpenTime } = get24hHighLow(closed);

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

  const isHighNewerThanLow = highOpenTime > lowOpenTime;

  if (
    !hasEntryRange ||
    !isWithinEntryMaxRange ||
    !isNear24hHigh ||
    !isHighNewerThanLow
  ) {
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
