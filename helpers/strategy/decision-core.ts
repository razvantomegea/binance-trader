import {
  BUY_NOTIONAL_PCT,
  ENTRY_RANGE_MAX_PCT,
  ENTRY_RANGE_PCT,
  TRAILING_STOP_PCT,
} from "@/constants/binance";
import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import { isGainWithinBand } from "@/utils/strategy/price-change-conditions";
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
  /** Fill price for SELL; capped to trailing stop and max loss floor. */
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

export function getCloseHighLow(closed: Pick<CandleSlice, "close">[]): {
  highClose: number;
  lowClose: number;
} {
  let highClose = closed[0]!.close;
  let lowClose = closed[0]!.close;
  for (const c of closed) {
    if (c.close > highClose) highClose = c.close;
    if (c.close < lowClose) lowClose = c.close;
  }
  return { highClose, lowClose };
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
        thresholdPct: TRAILING_STOP_PCT,
      })
    ) {
      const exitPrice = getTrailingExitPrice({
        position: stopPosition,
        thresholdPct: TRAILING_STOP_PCT,
      });

      return {
        action: "SELL",
        candleOpenTime: latest.openTime,
        reason: "exit_drawdown_15pct_vs_peak",
        qty: position.qty,
        exitPrice,
        updatedMaxPrice: updatedMax,
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

  const { highClose, lowClose } = getCloseHighLow(closed);

  const closeInBand = isGainWithinBand({
    value: close,
    ref: lowClose,
    minPct: ENTRY_RANGE_PCT,
    maxPct: ENTRY_RANGE_MAX_PCT,
  });
  const highInBand = isGainWithinBand({
    value: highClose,
    ref: lowClose,
    minPct: ENTRY_RANGE_PCT,
    maxPct: ENTRY_RANGE_MAX_PCT,
  });

  if (!closeInBand || !highInBand) {
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
    reason: "entry_24h_band_50_75pct",
    qty,
  };
}
