import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { StrategyParams } from "@/types/strategy-params";
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
  strategyParams?: StrategyParams;
  /** Precomputed entry probability for closed[0].openTime. */
  entryProbability?: number;
  /** When set, BUY requires entryProbability >= modelMinProbability. */
  modelMinProbability?: number;
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
    if (c.close > highClose) {
      highClose = c.close;
    }
    if (c.close < lowClose) {
      lowClose = c.close;
    }
  }
  return { highClose, lowClose };
}

export function isEntryBandCandidate(params: {
  closed: CandleSlice[];
  strategyParams?: StrategyParams;
}): boolean {
  if (params.closed.length < STRATEGY_LOOKBACK_CLOSES) {
    return false;
  }

  const strategyParams = params.strategyParams ?? DEFAULT_STRATEGY_PARAMS;
  const latest = params.closed[0]!;
  const { highClose, lowClose } = getCloseHighLow(params.closed);

  const closeInBand = isGainWithinBand({
    value: latest.close,
    ref: lowClose,
    minPct: strategyParams.entryRangePct,
    maxPct: strategyParams.entryRangeMaxPct,
  });
  const highInBand = isGainWithinBand({
    value: highClose,
    ref: lowClose,
    minPct: strategyParams.entryRangePct,
    maxPct: strategyParams.entryRangeMaxPct,
  });

  return closeInBand && highInBand;
}

function evaluateOpenPositionDecision(params: {
  latest: CandleSlice;
  position: DecisionPositionState;
  markPrice?: number;
  strategyParams: StrategyParams;
}): EvaluateDecisionResult {
  if (params.latest.openTime < params.position.buyOpenTime) {
    return { action: "SKIP", candleOpenTime: params.latest.openTime };
  }

  const currentMax =
    params.position.maxPriceAfterBuy ?? params.position.buyPrice;
  const updatedMax = getUpdatedPeakPrice({
    currentMax,
    high: params.latest.high,
    close: params.latest.close,
    markPrice: params.markPrice,
  });
  const stopPosition = {
    buyPrice: params.position.buyPrice,
    maxPriceAfterBuy: updatedMax,
  };
  const worstPrice = getWorstObservedPrice({
    low: params.latest.low,
    markPrice: params.markPrice ?? params.latest.close,
  });

  if (
    !shouldTriggerTrailingStop({
      position: stopPosition,
      worstPrice,
      thresholdPct: params.strategyParams.trailingStopPct,
      maxLossPct: params.strategyParams.maxLossPct,
    })
  ) {
    return {
      action: "HOLD",
      candleOpenTime: params.latest.openTime,
      updatedMaxPrice: updatedMax,
    };
  }

  const exitPrice = getTrailingExitPrice({
    position: stopPosition,
    thresholdPct: params.strategyParams.trailingStopPct,
    maxLossPct: params.strategyParams.maxLossPct,
  });
  return {
    action: "SELL",
    candleOpenTime: params.latest.openTime,
    reason: `exit_trailing_${params.strategyParams.trailingStopPct}_vs_peak`,
    qty: params.position.qty,
    exitPrice,
    updatedMaxPrice: updatedMax,
  };
}

function meetsModelProbabilityGate(params: {
  entryProbability?: number;
  modelMinProbability?: number;
}): boolean {
  if (params.modelMinProbability == null) {
    return true;
  }
  return (params.entryProbability ?? 0) >= params.modelMinProbability;
}

function evaluateEntryDecision(params: {
  closed: CandleSlice[];
  latest: CandleSlice;
  cash: number;
  lastSellOpenTime: number | null;
  strategyParams: StrategyParams;
  entryProbability?: number;
  modelMinProbability?: number;
}): EvaluateDecisionResult {
  if (
    params.lastSellOpenTime !== null &&
    params.latest.openTime - params.lastSellOpenTime <
      params.strategyParams.symbolReentryCooldownMs
  ) {
    return { action: "HOLD", candleOpenTime: params.latest.openTime };
  }

  if (
    !isEntryBandCandidate({
      closed: params.closed,
      strategyParams: params.strategyParams,
    })
  ) {
    return { action: "HOLD", candleOpenTime: params.latest.openTime };
  }

  const notional = params.cash * params.strategyParams.buyNotionalPct;
  if (notional <= 0 || params.latest.close <= 0) {
    return { action: "HOLD", candleOpenTime: params.latest.openTime };
  }

  const qty = notional / params.latest.close;
  if (!Number.isFinite(qty) || qty <= 0) {
    return { action: "HOLD", candleOpenTime: params.latest.openTime };
  }

  if (
    !meetsModelProbabilityGate({
      entryProbability: params.entryProbability,
      modelMinProbability: params.modelMinProbability,
    })
  ) {
    return { action: "HOLD", candleOpenTime: params.latest.openTime };
  }

  return {
    action: "BUY",
    candleOpenTime: params.latest.openTime,
    reason: `entry_band_${params.strategyParams.entryRangePct}_${params.strategyParams.entryRangeMaxPct}`,
    qty,
  };
}

export function evaluateDecision({
  closed,
  position,
  cash,
  lastProcessedOpenTime,
  lastSellOpenTime,
  markPrice,
  strategyParams = DEFAULT_STRATEGY_PARAMS,
  entryProbability,
  modelMinProbability,
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

  if (position) {
    return evaluateOpenPositionDecision({
      latest,
      position,
      markPrice,
      strategyParams,
    });
  }

  return evaluateEntryDecision({
    closed,
    latest,
    cash,
    lastSellOpenTime,
    strategyParams,
    entryProbability,
    modelMinProbability,
  });
}
